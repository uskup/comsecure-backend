import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  MessageSquare, 
  Users, 
  Trash2, 
  Search,
  Eye,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface AdminMessage {
  id: string;
  channel_id: string;
  nickname: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  channel_name: string;
}

interface AdminStats {
  totalMessages: number;
  totalUsers: number;
  totalChannels: number;
  deletedMessages: number;
}

const AdminPanel = () => {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalMessages: 0,
    totalUsers: 0,
    totalChannels: 0,
    deletedMessages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(() => {
    loadAdminData();
    loadChannels();
    
    // Set up real-time subscriptions
    const messagesChannel = supabase
      .channel('admin-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadAdminData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const loadChannels = async () => {
    const { data } = await supabase
      .from('channels')
      .select('*')
      .order('name');
    
    if (data) {
      setChannels(data);
    }
  };

  const loadAdminData = async () => {
    try {
      // Try to load from admin_messages view first
      let messagesData = null;
      
      try {
        const { data, error } = await supabase
          .from('admin_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (!error) {
          messagesData = data;
        }
      } catch (viewError) {
        console.log('Admin view not available, using fallback');
      }
      
      if (!messagesData) {
        // Fallback to regular messages with join
        const { data: regularData } = await supabase
          .from('messages')
          .select(`
            *,
            channels!inner(name)
          `)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (regularData) {
          messagesData = regularData.map(msg => ({
            ...msg,
            channel_name: (msg as any).channels.name,
            is_deleted: (msg as any).is_deleted || false,
            deleted_by: (msg as any).deleted_by || null,
            deleted_at: (msg as any).deleted_at || null
          }));
        }
      }
      
      if (messagesData) {
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }

    // Load statistics
    const [
      { count: totalMessages },
      { count: totalUsers },
      { count: totalChannels },
      { count: deletedMessages }
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('is_online', true),
      supabase.from('channels').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_deleted', true)
    ]);

    setStats({
      totalMessages: totalMessages || 0,
      totalUsers: totalUsers || 0,
      totalChannels: totalChannels || 0,
      deletedMessages: deletedMessages || 0
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    const nickname = localStorage.getItem('chatNickname') || 'ADMIN';
    
    try {
      // Try admin function first
      const { error: rpcError } = await supabase.rpc('delete_message_admin', {
        message_id: messageId,
        admin_nickname: nickname
      });
      
      if (rpcError) {
        // Fallback to direct update
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            is_deleted: true,
            deleted_by: nickname,
            deleted_at: new Date().toISOString()
          })
          .eq('id', messageId);
        
        if (updateError) {
          console.error('Error deleting message:', updateError);
          return;
        }
      }
      
      loadAdminData();
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = searchTerm === '' || 
      msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.nickname.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = selectedChannel === 'all' || msg.channel_id === selectedChannel;
    
    return matchesSearch && matchesChannel;
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-glow" />
        <div>
          <h1 className="text-2xl font-mono font-bold text-glow">
            ADMIN CONTROL PANEL
          </h1>
          <p className="text-sm text-text-secondary font-mono">
            Real-time monitoring and message management
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-surface border-metallic/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-metallic flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              TOTAL MESSAGES
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-glow">
              {stats.totalMessages}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-metallic/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-metallic flex items-center gap-2">
              <Users className="w-4 h-4" />
              ACTIVE USERS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-glow">
              {stats.totalUsers}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-metallic/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-metallic flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              CHANNELS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-glow">
              {stats.totalChannels}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-metallic/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-metallic flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              DELETED
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-destructive">
              {stats.deletedMessages}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search messages or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface border-metallic/30 text-text-primary placeholder:text-text-muted font-mono"
          />
        </div>
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="px-3 py-2 bg-surface border border-metallic/30 rounded-md text-text-primary font-mono text-sm"
        >
          <option value="all">All Channels</option>
          {channels.map(channel => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages List */}
      <Card className="bg-surface border-metallic/30 flex-1">
        <CardHeader>
          <CardTitle className="text-lg font-mono text-glow flex items-center gap-2">
            <Eye className="w-5 h-5" />
            MESSAGE MONITORING
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 p-4">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border transition-all ${
                    msg.is_deleted 
                      ? 'bg-destructive/10 border-destructive/30' 
                      : 'bg-surface-elevated border-metallic/20 hover:border-metallic/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{msg.channel_name}
                        </Badge>
                        <span className="font-mono text-sm text-metallic font-bold">
                          {msg.nickname}
                        </span>
                        <span className="text-xs text-text-muted font-mono">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.is_deleted && (
                          <Badge variant="destructive" className="text-xs font-mono">
                            DELETED
                          </Badge>
                        )}
                      </div>
                      
                      <p className={`text-sm leading-relaxed ${
                        msg.is_deleted ? 'text-text-muted italic line-through' : 'text-text-primary'
                      }`}>
                        {msg.content}
                      </p>
                      
                      {msg.is_deleted && msg.deleted_by && (
                        <div className="text-xs text-destructive font-mono mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deleted by {msg.deleted_by} at {formatTime(msg.deleted_at!)}
                        </div>
                      )}
                    </div>
                    
                    {!msg.is_deleted && (
                      <Button
                        onClick={() => handleDeleteMessage(msg.id)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {filteredMessages.length === 0 && (
                <div className="text-center py-8 text-text-muted font-mono">
                  No messages found matching your criteria
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;