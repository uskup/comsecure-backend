import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  MicOff, 
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface VoiceControlsProps {
  channelId: string;
  nickname: string;
}

const VoiceControls = ({ channelId, nickname }: VoiceControlsProps) => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  
  const {
    isConnected,
    isMuted,
    isDeafened,
    voiceUsers,
    audioLevel,
    connectionError,
    toggleMute,
    toggleDeafen
  } = useVoiceChat({
    channelId,
    nickname,
    isEnabled: isVoiceEnabled
  });

  const handleToggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
  };

  const getVoiceStatusColor = () => {
    if (connectionError) return 'bg-red-500';
    if (!isConnected) return 'bg-gray-500';
    if (isMuted) return 'bg-yellow-500';
    if (audioLevel > 0.15) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getVoiceStatusText = () => {
    if (connectionError) return 'Error';
    if (!isConnected) return 'Disconnected';
    if (isMuted) return 'Muted';
    if (audioLevel > 0.15) return 'Speaking';
    return 'Connected';
  };

  return (
    <div className="bg-surface-elevated border-t border-metallic/20 p-3">
      {/* Connection Error Alert */}
      {connectionError && (
        <Alert className="mb-3 bg-destructive/10 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs font-mono">
            {connectionError}
          </AlertDescription>
        </Alert>
      )}

      {/* Voice Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getVoiceStatusColor()} ${isConnected ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-mono text-text-secondary">
            VOICE: {getVoiceStatusText()}
          </span>
          {isConnected && (
            <Badge variant="outline" className="text-xs font-mono">
              {voiceUsers.length} ACTIVE
            </Badge>
          )}
        </div>
        
        {/* Audio Level Indicator */}
        {isConnected && !isMuted && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-full transition-all duration-100 ${
                  audioLevel * 5 > i ? 'bg-green-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Voice Controls */}
      <div className="flex items-center gap-2 mb-3">
        {/* Connect/Disconnect */}
        <Button
          onClick={handleToggleVoice}
          variant={isConnected ? "destructive" : "default"}
          size="sm"
          className="font-mono text-xs flex-1"
        >
          {isConnected ? (
            <>
              <PhoneOff className="w-4 h-4 mr-1" />
              DISCONNECT
            </>
          ) : (
            <>
              <Phone className="w-4 h-4 mr-1" />
              JOIN VOICE
            </>
          )}
        </Button>
      </div>

      {/* Mute/Deafen Controls */}
      {isConnected && (
        <div className="flex items-center gap-2 mb-3">
          {/* Mute Toggle */}
          <Button
            onClick={toggleMute}
            variant={isMuted ? "destructive" : "outline"}
            size="sm"
            className="font-mono text-xs flex-1"
          >
            {isMuted ? (
              <>
                <MicOff className="w-4 h-4 mr-1" />
                MUTED
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-1" />
                LIVE
              </>
            )}
          </Button>

          {/* Deafen Toggle */}
          <Button
            onClick={toggleDeafen}
            variant={isDeafened ? "destructive" : "outline"}
            size="sm"
            className="font-mono text-xs flex-1"
          >
            {isDeafened ? (
              <>
                <VolumeX className="w-4 h-4 mr-1" />
                DEAF
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-1" />
                HEAR
              </>
            )}
          </Button>
        </div>
      )}

      {/* Active Voice Users */}
      {isConnected && voiceUsers.length > 0 && (
        <div className="pt-3 border-t border-metallic/20">
          <div className="text-xs font-mono text-text-muted mb-2 flex items-center gap-2">
            <Radio className="w-3 h-3" />
            VOICE PARTICIPANTS ({voiceUsers.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {voiceUsers.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                  user.isSpeaking 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-surface hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-6 h-6 bg-gradient-to-br from-metallic to-metallic-bright rounded-lg flex items-center justify-center text-black font-mono font-bold text-xs">
                      {user.nickname.charAt(0)}
                    </div>
                    {user.isSpeaking && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="text-xs font-mono text-text-primary">
                    {user.nickname}
                  </span>
                  {user.nickname === nickname && (
                    <Badge variant="outline" className="text-xs">YOU</Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  {user.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                  {user.isSpeaking && !user.isMuted && (
                    <div className="flex items-center gap-0.5">
                      <Radio className="w-3 h-3 text-green-500 animate-pulse" />
                      {/* Audio level for speaking users */}
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-0.5 h-2 rounded-full transition-all duration-100 ${
                            user.audioLevel * 3 > i ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {!user.isSpeaking && !user.isMuted && (
                    <Wifi className="w-3 h-3 text-blue-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Instructions */}
      {!isConnected && !connectionError && (
        <div className="pt-3 border-t border-metallic/20">
          <div className="text-xs text-text-muted font-mono space-y-1">
            <p>• Click "JOIN VOICE" to start voice communication</p>
            <p>• Allow microphone access when prompted</p>
            <p>• Use mute/deafen controls during conversation</p>
            <p>• Voice chat is peer-to-peer encrypted</p>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {isConnected && (
        <div className="pt-3 border-t border-metallic/20">
          <div className="text-xs text-text-muted font-mono flex items-center gap-2">
            <Wifi className="w-3 h-3 text-green-500" />
            Voice chat active • P2P encrypted • Real-time communication
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;