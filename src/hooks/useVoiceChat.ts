import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Peer from 'simple-peer';

interface VoiceUser {
  id: string;
  nickname: string;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

interface UseVoiceChatProps {
  channelId: string;
  nickname: string;
  isEnabled: boolean;
}

export const useVoiceChat = ({ channelId, nickname, isEnabled }: UseVoiceChatProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const channelRef = useRef<any>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Initialize audio context and analyzer
  const initializeAudio = useCallback(async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });
      
      localStreamRef.current = stream;
      console.log('Microphone access granted');
      
      // Create audio context for voice activity detection
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Start voice activity detection
      startVoiceActivityDetection();
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setConnectionError('Microphone access denied. Please allow microphone access and try again.');
      throw error;
    }
  }, []);

  // Voice activity detection
  const startVoiceActivityDetection = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const detectVoice = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setAudioLevel(normalizedLevel);
      
      // Broadcast voice activity to other users
      if (channelRef.current && normalizedLevel > 0.05) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'voice_activity',
          payload: {
            userId: nickname,
            isSpeaking: normalizedLevel > 0.15,
            audioLevel: normalizedLevel,
            isMuted: isMuted
          }
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(detectVoice);
    };
    
    detectVoice();
  }, [nickname, isMuted]);

  // Create peer connection
  const createPeer = useCallback((targetUser: string, initiator: boolean) => {
    console.log(`Creating peer connection with ${targetUser}, initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: localStreamRef.current || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      console.log(`Sending signal to ${targetUser}:`, data.type);
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: {
            target: targetUser,
            from: nickname,
            signal: data
          }
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log(`Received stream from ${targetUser}`);
      playRemoteAudio(remoteStream, targetUser);
    });

    peer.on('connect', () => {
      console.log(`Connected to ${targetUser}`);
    });

    peer.on('error', (err) => {
      console.error(`Peer error with ${targetUser}:`, err);
      peersRef.current.delete(targetUser);
    });

    peer.on('close', () => {
      console.log(`Connection closed with ${targetUser}`);
      peersRef.current.delete(targetUser);
      removeRemoteAudio(targetUser);
    });

    peersRef.current.set(targetUser, peer);
    return peer;
  }, [nickname]);

  // Play remote audio
  const playRemoteAudio = useCallback((stream: MediaStream, userId: string) => {
    console.log(`Setting up audio for ${userId}`);
    
    // Remove existing audio element if any
    removeRemoteAudio(userId);
    
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = isDeafened ? 0 : 1;
    audio.style.display = 'none';
    
    // Add to DOM and store reference
    document.body.appendChild(audio);
    remoteAudiosRef.current.set(userId, audio);
    
    // Handle audio play promise
    audio.play().catch(err => {
      console.warn(`Audio play failed for ${userId}:`, err);
    });
  }, [isDeafened]);

  // Remove remote audio
  const removeRemoteAudio = useCallback((userId: string) => {
    const audio = remoteAudiosRef.current.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      remoteAudiosRef.current.delete(userId);
    }
  }, []);

  // Connect to voice channel
  const connectToVoice = useCallback(async () => {
    if (!isEnabled || isConnected) return;
    
    try {
      setConnectionError(null);
      console.log('Connecting to voice...');
      
      await initializeAudio();
      
      // Subscribe to voice channel
      channelRef.current = supabase.channel(`voice:${channelId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: nickname }
        }
      });

      // Handle presence changes (users joining/leaving)
      channelRef.current.on('presence', { event: 'sync' }, () => {
        const state = channelRef.current.presenceState();
        const users = Object.keys(state).map(key => ({
          id: key,
          nickname: key,
          isMuted: false,
          isSpeaking: false,
          audioLevel: 0
        }));
        
        console.log('Voice users updated:', users);
        setVoiceUsers(users);
        
        // Initiate connections with new users
        users.forEach(user => {
          if (user.nickname !== nickname && !peersRef.current.has(user.nickname)) {
            // Only initiate if we're the "smaller" nickname (to avoid duplicate connections)
            if (nickname < user.nickname) {
              createPeer(user.nickname, true);
            }
          }
        });
      });

      channelRef.current.on('presence', { event: 'join' }, ({ key }) => {
        console.log(`User ${key} joined voice`);
        if (key !== nickname && !peersRef.current.has(key)) {
          // Only initiate if we're the "smaller" nickname
          if (nickname < key) {
            createPeer(key, true);
          }
        }
      });

      channelRef.current.on('presence', { event: 'leave' }, ({ key }) => {
        console.log(`User ${key} left voice`);
        const peer = peersRef.current.get(key);
        if (peer) {
          peer.destroy();
          peersRef.current.delete(key);
        }
        removeRemoteAudio(key);
        
        setVoiceUsers(prev => prev.filter(user => user.nickname !== key));
      });

      // Handle voice activity updates
      channelRef.current.on('broadcast', { event: 'voice_activity' }, ({ payload }) => {
        if (payload.userId !== nickname) {
          setVoiceUsers(prev => prev.map(user => 
            user.nickname === payload.userId 
              ? { 
                  ...user, 
                  isSpeaking: payload.isSpeaking, 
                  audioLevel: payload.audioLevel,
                  isMuted: payload.isMuted
                }
              : user
          ));
        }
      });

      // Handle WebRTC signaling
      channelRef.current.on('broadcast', { event: 'webrtc_signal' }, ({ payload }) => {
        if (payload.target === nickname) {
          handleWebRTCSignal(payload);
        }
      });

      await channelRef.current.subscribe();
      
      // Track presence
      await channelRef.current.track({
        user: nickname,
        online_at: new Date().toISOString()
      });
      
      setIsConnected(true);
      console.log('Voice connection established');
    } catch (error) {
      console.error('Error connecting to voice:', error);
      setConnectionError('Failed to connect to voice chat. Please check your microphone permissions.');
    }
  }, [isEnabled, isConnected, channelId, nickname, initializeAudio, createPeer]);

  // Handle WebRTC signaling
  const handleWebRTCSignal = useCallback(async (payload: any) => {
    const { from, signal } = payload;
    
    let peer = peersRef.current.get(from);
    
    if (!peer) {
      // Create peer as non-initiator
      peer = createPeer(from, false);
    }
    
    try {
      peer.signal(signal);
    } catch (error) {
      console.error(`Error handling signal from ${from}:`, error);
    }
  }, [createPeer]);

  // Disconnect from voice
  const disconnectFromVoice = useCallback(() => {
    console.log('Disconnecting from voice...');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track:', track.kind);
      });
      localStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Close all peer connections
    peersRef.current.forEach((peer, userId) => {
      console.log(`Closing peer connection with ${userId}`);
      peer.destroy();
      removeRemoteAudio(userId);
    });
    peersRef.current.clear();
    
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    
    setIsConnected(false);
    setVoiceUsers([]);
    setAudioLevel(0);
    setConnectionError(null);
    console.log('Voice disconnected');
  }, [removeRemoteAudio]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        console.log(`Microphone ${isMuted ? 'unmuted' : 'muted'}`);
        
        // Broadcast mute status
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'voice_activity',
            payload: {
              userId: nickname,
              isMuted: !isMuted,
              isSpeaking: false,
              audioLevel: 0
            }
          });
        }
      }
    }
  }, [isMuted, nickname]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
    
    // Update volume for all remote audio elements
    remoteAudiosRef.current.forEach((audio) => {
      audio.volume = newDeafenState ? 0 : 1;
    });
    
    console.log(`Audio ${newDeafenState ? 'deafened' : 'undeafened'}`);
  }, [isDeafened]);

  // Effect to handle connection
  useEffect(() => {
    if (isEnabled && channelId && nickname) {
      connectToVoice();
    } else {
      disconnectFromVoice();
    }
    
    return () => {
      disconnectFromVoice();
    };
  }, [isEnabled, channelId, nickname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromVoice();
    };
  }, [disconnectFromVoice]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    voiceUsers,
    audioLevel,
    connectionError,
    connectToVoice,
    disconnectFromVoice,
    toggleMute,
    toggleDeafen
  };
};