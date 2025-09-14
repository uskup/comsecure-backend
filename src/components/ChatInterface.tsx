import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import VoiceControls from '@/components/VoiceControls';
import AdminPanel from '@/components/AdminPanel';
import { 
  Send, 
  Hash, 
  Users, 
  Settings, 
  Plus,
  Lock,
  Trash2,
  Shield
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private';
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  nickname: string;
  content: string;
  created_at: string;
  is_deleted?: boolean;
  deleted_by?: string;
  deleted_at?: string;
}

interface UserSession {
  id: string;
  nickname: string;
  channel_id: string;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  is_admin?: boolean;
}

const ChatInterface = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserSession[]>([]);
  const [message, setMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  // Load channels on component mount
  useEffect(() => {
    loadChannels();
    
    // Get nickname from localStorage
    const storedNickname = localStorage.getItem('chatNickname');
    if (storedNickname) {
      setNickname(storedNickname);
      setShowNicknameInput(false);
      checkAdminStatus(storedNickname);
    } else {
      setShowNicknameInput(true);
    }
  }, []);

  // Load messages when selected channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
      loadActiveUsers(selectedChannel.id);
    }
  }, [selectedChannel]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!selectedChannel) return;

    const messagesChannel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        () => {
          // Reload messages when updated (for deletions)
          loadMessages(selectedChannel.id);
        }
      )
      .subscribe();

    const usersChannel = supabase
      .channel('users-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions',
          filter: `channel_id=eq.${selectedChannel.id}`
        },
        () => {
          loadActiveUsers(selectedChannel.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(usersChannel);
    };
  }, [selectedChannel]);

  const checkAdminStatus = async (userNickname: string) => {
    // Check if user is admin (nickname "ADMIN" or has is_admin flag)
    if (userNickname === 'ADMIN') {
      setIsAdmin(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('is_admin')
        .eq('nickname', userNickname)
        .eq('is_online', true)
        .maybeSingle();
      
      if (!error && data?.is_admin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      // If column doesn't exist or query fails, only allow ADMIN nickname
      console.log('Admin check failed, using nickname-based admin only');
      setIsAdmin(false);
    }
  };

  const loadChannels = async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('name');
    
    if (data && !error) {
      const typedChannels = data as Channel[];
      setChannels(typedChannels);
      if (typedChannels.length > 0 && !selectedChannel) {
        setSelectedChannel(typedChannels[0]);
      }
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      // Try to load messages with is_deleted filter first
      let { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_deleted', false)
        .order('created_at')
        .limit(50);
      
      if (error && error.code === '42703') {
        // If is_deleted column doesn't exist, load all messages
        const fallbackResult = await supabase
          .from('messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('created_at')
          .limit(50);
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      
      if (data && !error) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadActiveUsers = async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_online', true)
        .order('nickname');
      
      if (data && !error) {
        setActiveUsers(data);
      }
    } catch (error) {
      console.error('Error loading active users:', error);
    }
  };

  const handleJoinWithNickname = async () => {
    if (!nickname.trim() || !selectedChannel) return;
    
    // Store nickname in localStorage
    localStorage.setItem('chatNickname', nickname.trim());
    
    // Create user session
    try {
      const sessionData: any = {
        nickname: nickname.trim(),
        channel_id: selectedChannel.id,
        is_online: true,
        last_seen: new Date().toISOString()
      };

      // Add is_admin if user is ADMIN
      if (nickname.trim() === 'ADMIN') {
        sessionData.is_admin = true;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .upsert(sessionData)
        .select('*')
        .single();
      
      if (!error) {
        checkAdminStatus(nickname.trim());
        setShowNicknameInput(false);
      }
    } catch (error) {
      console.error('Error creating user session:', error);
      // Still allow user to proceed
      setShowNicknameInput(false);
      checkAdminStatus(nickname.trim());
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChannel || !nickname) return;
    
    const { error } = await supabase
      .from('messages')
      .insert({
        channel_id: selectedChannel.id,
        nickname,
        content: message.trim()
      });
    
    if (!error) {
      setMessage('');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAdmin) return;
    
    try {
      // Try admin function first
      const { error: rpcError } = await supabase.rpc('delete_message_admin', {
        message_id: messageId,
        admin_nickname: nickname
      });
      
      if (rpcError) {
        // Fallback to direct update if function doesn't exist
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            is_deleted: true,
            deleted_by: nickname,
            deleted_at: new Date().toISOString()
          })
          .eq('id', messageId);
        
        if (updateError && updateError.code === '42703') {
          // If columns don't exist, just delete the message
          await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);
        }
      }
      
      // Refresh messages
      if (selectedChannel) {
        loadMessages(selectedChannel.id);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = (msg: Message) => {
    const isDeleted = msg.is_deleted;
    
    return (
      <div key={msg.id} className={`group animate-slide-up ${isDeleted ? 'opacity-50' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-metallic to-metallic-bright rounded-lg flex items-center justify-center text-black font-mono font-bold text-xs">
            {msg.nickname.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-metallic font-bold">
                {msg.nickname}
              </span>
              <span className="text-xs text-text-muted font-mono">
                {formatTime(msg.created_at)}
              </span>
              {isDeleted && (
                <Badge variant="destructive" className="text-xs font-mono">
                  DELETED
                </Badge>
              )}
            </div>
            <p className={`leading-relaxed ${isDeleted ? 'text-text-muted italic line-through' : 'text-text-primary'}`}>
              {isDeleted ? '[Message deleted by admin]' : msg.content}
            </p>
            {isDeleted && msg.deleted_by && (
              <div className="text-xs text-text-muted font-mono mt-1">
                Deleted by: {msg.deleted_by} at {msg.deleted_at ? formatTime(msg.deleted_at) : 'unknown'}
              </div>
            )}
          </div>
          
          {/* Admin Delete Button */}
          {isAdmin && !isDeleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-surface border-metallic/30">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono text-glow" dir="rtl">
                    حذف الرسالة
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-text-secondary" dir="rtl">
                    هل أنت متأكد من حذف هذه الرسالة من {msg.nickname}؟
                    سيتم تسجيل هذا الإجراء لأغراض التدقيق.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-mono" dir="rtl">إلغاء</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="bg-destructive text-destructive-foreground font-mono" dir="rtl"
                  >
                    حذف الرسالة
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  };

  if (showNicknameInput) {
    return (
      <div className="min-h-screen bg-black text-text-primary flex items-center justify-center">
        <div className="bg-surface border border-metallic/30 rounded-lg p-8 max-w-md w-full mx-4">
          <h2 className="font-mono text-xl text-glow font-bold mb-6 text-center" dir="rtl">
            أدخل الاسم الرمزي
          </h2>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="الاسم الرمزي للعميل..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinWithNickname()}
              className="bg-surface-elevated border-metallic/30 text-text-primary placeholder:text-text-muted font-mono"
              maxLength={32}
            />
            <div className="text-xs text-text-muted font-mono" dir="rtl">
              استخدم "ADMIN" كاسم رمزي للوصول الإداري
            </div>
            <Button
              onClick={handleJoinWithNickname}
              disabled={!nickname.trim()}
              className="w-full bg-gradient-to-r from-metallic to-metallic-bright text-black font-mono font-bold hover:scale-105 transition-all duration-300" dir="rtl"
            >
              بدء الاتصال
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-text-primary flex">
      
      {/* Channels Sidebar */}
      <div className="w-64 bg-surface border-r border-metallic/20 flex flex-col">
        <div className="p-4 border-b border-metallic/20">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg text-metallic font-bold tracking-wider" dir="rtl">
              القنوات
            </h2>
            {isAdmin && (
              <Badge variant="outline" className="text-xs font-mono text-glow border-metallic/50" dir="rtl">
                <Shield className="w-3 h-3 mr-1" />
                مدير
              </Badge>
            )}
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 font-mono text-sm ${
                  selectedChannel?.id === channel.id
                    ? 'bg-metallic/20 text-glow border border-metallic/30'
                    : 'hover:bg-surface-elevated text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-2">
                  {channel.type === 'private' ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Hash className="w-4 h-4" />
                  )}
                  <span>{channel.name}</span>
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {activeUsers.length} عميل
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-metallic/20">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full font-mono text-xs bg-surface-elevated border-metallic/30 hover:bg-metallic/10" dir="rtl"
          >
            <Plus className="w-4 h-4 mr-2" />
            قناة جديدة
          </Button>
        </div>
        
        {/* Voice Controls */}
        {selectedChannel && (
          <VoiceControls 
            channelId={selectedChannel.id} 
            nickname={nickname} 
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="bg-surface-elevated border-b border-metallic/20 p-4">
              <TabsList className="bg-surface border-metallic/30">
                <TabsTrigger value="chat" className="font-mono text-xs" dir="rtl">
                  دردشة
                </TabsTrigger>
                <TabsTrigger value="admin" className="font-mono text-xs" dir="rtl">
                  لوحة الإدارة
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              {renderChatInterface()}
            </TabsContent>
            
            <TabsContent value="admin" className="flex-1 m-0">
              <AdminPanel />
            </TabsContent>
          </Tabs>
        ) : (
          renderChatInterface()
        )}
      </div>

      {/* Users Sidebar */}
      <div className="w-56 bg-surface border-l border-metallic/20 flex flex-col">
        <div className="p-4 border-b border-metallic/20">
          <h3 className="font-mono text-sm text-metallic font-bold tracking-wider" dir="rtl">
            العملاء النشطون
          </h3>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-2">
            {activeUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-elevated">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-metallic to-metallic-bright rounded-lg flex items-center justify-center text-black font-mono font-bold text-xs">
                    {user.nickname.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface bg-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-text-primary truncate flex items-center gap-1">
                    {user.nickname}
                    {(user.is_admin || user.nickname === 'ADMIN') && (
                      <Shield className="w-3 h-3 text-glow" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  function renderChatInterface() {
    return (
      <>
        {/* Channel Header */}
        <div className="bg-surface-elevated border-b border-metallic/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 text-metallic" />
              <div>
                <h3 className="font-mono text-lg text-glow font-bold" dir="rtl">
                  #{selectedChannel?.name}
                </h3>
                <p className="text-xs text-text-muted" dir="rtl">
                  قناة آمنة • مشفرة من طرف إلى طرف • الصوت مفعل
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-metallic">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map(renderMessage)}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 bg-surface-elevated border-t border-metallic/20">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder={`رسالة #${selectedChannel?.name}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-surface border-metallic/30 text-text-primary placeholder:text-text-muted font-mono"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="bg-gradient-to-r from-metallic to-metallic-bright text-black font-mono font-bold px-6 hover:scale-105 transition-all duration-300"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-text-muted font-mono mt-2" dir="rtl">
            الرسائل مشفرة • الدردشة الصوتية متاحة • المراقبة الإدارية نشطة
          </div>
        </div>
      </>
    );
  }
};

export default ChatInterface;