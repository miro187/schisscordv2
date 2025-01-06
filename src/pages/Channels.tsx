import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Plus, Hash, Volume2, ChevronDown, Settings, Smile, Image as ImageIcon, UserPlus, X, MoreVertical } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import VoiceChat from '../components/VoiceChat';

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  description: string | null;
  is_private: boolean;
}

interface Category {
  id: string;
  name: string;
  server_id: string;
  position: number;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  category_id: string;
  server_id: string;
  position: number;
}

interface DatabaseUser {
  username: string;
  avatar_url?: string | null;
}

interface DatabaseChannelMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    avatar_url?: string | null;
  } | null;
}

interface ChannelMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url?: string | null;
  };
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

interface ServerMember {
  user_id: string;
  role: string;
  user: {
    username: string;
    avatar_url?: string | null;
  };
}

interface ServerInvite {
  id: string;
  server_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  inviter: {
    username: string;
  };
}

interface FriendProfile {
  username: string;
}

interface DatabaseFriend {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  sender: {
    username: string;
  };
  receiver: {
    username: string;
  };
}

interface Friend {
  id: string;
  username: string;
  status: string;
  is_sender: boolean;
}

// Neue Interface für ungelesene Nachrichten
interface UnreadCount {
  [channelId: string]: number;
}

interface MessageProfile {
  username: string;
}

interface DatabaseMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: MessageProfile;
}

interface ChannelSubscription {
  channelId: string;
  subscription: RealtimeChannel;
}

// Neue Interface für Online-Status
interface OnlineStatus {
  [userId: string]: boolean;
}

// Neue Interface für Channel-Mitglieder
interface ChannelMember {
  user_id: string;
  username: string;
  avatarUrl: string | null | undefined;
}

interface DatabaseChannelMember {
  user_id: string;
  profiles: {
    username: string;
  };
}

interface DatabaseServerMember {
  user_id: string;
  role: string;
  profiles: {
    username: string;
    avatar_url?: string | null;
  };
}

interface VoiceChannelMember {
  user_id: string;
  channel_id: string;
  joined_at: string;
}

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
}

interface VoiceChannelMemberData {
  user_id: string;
  profiles: ProfileData;
}

// Hilfsfunktion zum Erkennen und Umwandeln von URLs in Links
const parseMessageContent = (content: string) => {
  // Regex für URL-Erkennung (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  
  // Teile den Text in Stücke auf, wobei URLs separat behandelt werden
  const parts = content.split(urlRegex);
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    // Prüfe ob der Teil eine URL ist
    if (urlRegex.test(part)) {
      const href = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    return <span key={index}>{part}</span>;
  });
};

const Channels = () => {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [showNewServerModal, setShowNewServerModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverSettings, setServerSettings] = useState({
    name: '',
    description: '',
    isPrivate: false
  });
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<ServerInvite[]>([]);
  const [showMembersBar, setShowMembersBar] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentCategoryId, setCurrentCategoryId] = useState<string>('');
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount>({});
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineStatus>({});
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNearBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const threshold = 100; // Pixel-Schwelle zum unteren Rand
      return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }
    return false;
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      setShouldAutoScroll(isNearBottom());
    }
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToBottom = () => {
    if (messagesContainerRef.current && shouldAutoScroll) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (activeServer) {
      fetchCategoriesAndChannels(activeServer.id);
      loadServerMembers();
      loadPendingInvites();
      // Reset activeChannel when server changes
      setActiveChannel(null);
      setMessages([]);
    }
  }, [activeServer]);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  // Separate useEffect für das Laden von Nachrichten beim Channel-Wechsel
  useEffect(() => {
    if (activeChannel?.type === 'text') {
      // Initial load
      loadChannelMessages();

      // Polling setup
      const pollInterval = setInterval(loadChannelMessages, 1000);

      // Cleanup
      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [activeChannel]);

  // Modifizierte loadChannelMessages Funktion
  const loadChannelMessages = async () => {
    if (!activeChannel) return;

    try {
      const { data: messages, error } = await supabase
        .from('channel_messages')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('channel_id', activeChannel.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(messages || []);
    } catch (err) {
      console.error('Error in loadChannelMessages:', err);
    }
  };

  // Neue useEffect für globale Channel-Subscriptions
  useEffect(() => {
    if (!channels.length) return;

    const subscriptions: ChannelSubscription[] = channels
      .filter(channel => channel.type === 'text')
      .map(channel => {
        const channelName = `channel-messages:${channel.id}`;
        console.log(`Setting up subscription for channel ${channel.id}`);

        return {
          channelId: channel.id,
          subscription: supabase
            .channel(channelName)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'channel_messages',
                filter: `channel_id=eq.${channel.id}`
              },
              async (payload) => {
                if (channel.id === activeChannel?.id) {
                  if (payload.eventType === 'INSERT') {
                    const { data: messageData } = await supabase
                      .from('channel_messages')
                      .select('*, profiles:user_id(username, avatar_url)')
                      .eq('id', payload.new.id)
                      .single();

                    if (messageData) {
                      setMessages(prev => [...prev, {
                        id: messageData.id,
                        content: messageData.content,
                        user_id: messageData.user_id,
                        created_at: messageData.created_at,
                        profiles: {
                          username: messageData.profiles?.username || 'Unknown',
                          avatar_url: messageData.profiles?.avatar_url
                        }
                      }]);
                      
                      if (shouldAutoScroll) {
                        setTimeout(scrollToBottom, 100);
                      }
                    }
                  } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
                  } else if (payload.eventType === 'UPDATE') {
                    // Lade die Nachrichten neu wenn eine Nachricht aktualisiert wurde
                    loadChannelMessages();
                  }
                }
              }
            )
            .subscribe(),
        };
      });

    return () => {
      console.log('Cleaning up channel subscriptions');
      subscriptions.forEach(({ subscription }) => {
        console.log('Removing subscription');
        supabase.removeChannel(subscription);
      });
    };
  }, [channels, activeChannel?.id]);

  // Presence tracking für die gesamte Anwendung
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global_presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const handleSync = () => {
      const newState = channel.presenceState();
      // Extrahiere die User-IDs direkt aus dem Presence State
      const onlineIds = Object.keys(newState);
      
      const newOnlineStatus: OnlineStatus = {};
      serverMembers.forEach(member => {
        newOnlineStatus[member.user_id] = onlineIds.includes(member.user_id);
      });
      
      setOnlineUsers(newOnlineStatus);
    };

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .on('presence', { event: 'join' }, handleSync)
      .on('presence', { event: 'leave' }, handleSync)
      .subscribe(async (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Cleanup function
    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [user?.id, serverMembers]);

  const fetchServers = async () => {
    if (!user) return;

    try {
      // Hole zuerst die Server-IDs, bei denen der Benutzer Mitglied ist
      const { data: memberServerIds } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', user.id);

      // Erstelle ein Array der Server-IDs
      const serverIds = memberServerIds?.map(item => item.server_id) || [];

      // Hole dann alle Server, bei denen der Benutzer Besitzer ist oder Mitglied ist
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .or(`owner_id.eq.${user.id},id.in.(${serverIds.join(',')})`)
        .order('created_at');

      if (error) {
        console.error('Error fetching servers:', error);
        return;
      }

      setServers(data || []);
      if (data?.[0] && !activeServer) {
        setActiveServer(data[0]);
      }
    } catch (err) {
      console.error('Error in fetchServers:', err);
    }
  };

  const fetchCategoriesAndChannels = async (serverId: string) => {
    const [categoriesResponse, channelsResponse] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('server_id', serverId)
        .order('position'),
      supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('position')
    ]);

    if (categoriesResponse.error) console.error('Error fetching categories:', categoriesResponse.error);
    if (channelsResponse.error) console.error('Error fetching channels:', channelsResponse.error);

    const newCategories = categoriesResponse.data || [];
    setCategories(newCategories);
    
    // Automatisch alle Kategorien ausklappen
    setExpandedCategories(new Set(newCategories.map(cat => cat.id)));
    
    setChannels(channelsResponse.data || []);
  };

  const createServer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newServerName.trim() || !user) return;

    try {
      // Transaktion starten
      const { data: server, error: serverError } = await supabase
        .from('servers')
        .insert({
          name: newServerName.trim(),
          owner_id: user.id,
          description: '',
          is_private: false
        })
        .select()
        .single();

      if (serverError) {
        console.error('Error creating server:', serverError);
        return;
      }

      // Standardkategorie erstellen
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert({
          server_id: server.id,
          name: 'Text Channels',
          position: 0
        })
        .select()
        .single();

      if (categoryError) {
        console.error('Error creating category:', categoryError);
        // Server löschen bei Fehler
        await supabase.from('servers').delete().eq('id', server.id);
        return;
      }

      // Standardkanal erstellen
      const { error: channelError } = await supabase
        .from('channels')
        .insert({
          server_id: server.id,
          category_id: category.id,
          name: 'general',
          type: 'text',
          position: 0
        });

      if (channelError) {
        console.error('Error creating channel:', channelError);
        // Server und Kategorie löschen bei Fehler
        await supabase.from('servers').delete().eq('id', server.id);
        return;
      }

      setNewServerName('');
      setShowNewServerModal(false);
      fetchServers();
    } catch (err) {
      console.error('Error creating server:', err);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const createCategory = async () => {
    if (!newCategoryName.trim() || !activeServer) return;

    try {
      const { data: category, error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName.trim(),
          server_id: activeServer.id,
          position: categories.length
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, category]);
      setNewCategoryName('');
      setShowNewCategoryModal(false);
      setExpandedCategories(prev => new Set([...prev, category.id]));
    } catch (err) {
      console.error('Error creating category:', err);
      alert('Fehler beim Erstellen der Kategorie');
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim() || !activeServer || !currentCategoryId) return;

    try {
      // Prüfe, ob der Channel-Name bereits existiert
      const { data: existingChannels } = await supabase
        .from('channels')
        .select('name')
        .eq('server_id', activeServer.id)
        .eq('name', newChannelName.trim());

      if (existingChannels && existingChannels.length > 0) {
        alert('Ein Channel mit diesem Namen existiert bereits!');
        return;
      }

      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          type: newChannelType,
          category_id: currentCategoryId,
          server_id: activeServer.id,
          position: channels.filter(c => c.category_id === currentCategoryId).length
        })
        .select()
        .single();

      if (error) throw error;

      setChannels(prev => [...prev, channel]);
      setNewChannelName('');
      setShowNewChannelModal(false);
      setActiveChannel(channel);
    } catch (err) {
      console.error('Error creating channel:', err);
      alert('Fehler beim Erstellen des Channels');
    }
  };

  const updateServer = async () => {
    if (!activeServer) return;

    try {
      const { error } = await supabase
        .from('servers')
        .update({
          name: serverSettings.name,
          description: serverSettings.description,
          is_private: serverSettings.isPrivate
        })
        .eq('id', activeServer.id);

      if (error) throw error;

      setServers(prev =>
        prev.map(server =>
          server.id === activeServer.id
            ? { ...server, name: serverSettings.name }
            : server
        )
      );
      setShowServerSettings(false);
    } catch (err) {
      console.error('Error updating server:', err);
    }
  };

  const deleteServer = async () => {
    if (!activeServer) return;

    try {
      const { error } = await supabase
        .from('servers')
        .delete()
        .eq('id', activeServer.id);

      if (error) throw error;

      setServers(prev => prev.filter(server => server.id !== activeServer.id));
      setActiveServer(servers.find(server => server.id !== activeServer.id) || null);
      setShowServerSettings(false);
    } catch (err) {
      console.error('Error deleting server:', err);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      // Optimistisch die Nachricht aus der UI entfernen
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      // Aus der Datenbank löschen
      const { error } = await supabase
        .from('channel_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting message:', error);
        // Bei Fehler die Nachrichten neu laden
        loadChannelMessages();
      }
    } catch (err) {
      console.error('Error:', err);
      // Bei Fehler die Nachrichten neu laden
      loadChannelMessages();
    }
  };

  const loadServerMembers = async () => {
    if (!activeServer) return;

    try {
      const { data, error } = await supabase
        .from('server_members')
        .select(`
          user_id,
          role,
          profiles!server_members_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('server_id', activeServer.id)
        .returns<DatabaseServerMember[]>();

      if (error) {
        console.error('Error loading server members:', error);
        return;
      }

      const formattedMembers = (data || []).map(member => ({
        user_id: member.user_id,
        role: member.role,
        user: {
          username: member.profiles.username,
          avatar_url: member.profiles.avatar_url
        }
      }));

      setServerMembers(formattedMembers);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const loadPendingInvites = async () => {
    if (!activeServer) return;

    const { data, error } = await supabase
      .from('server_invites')
      .select('*, inviter:profiles!inviter_id(username)')
      .eq('server_id', activeServer.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error loading pending invites:', error);
      return;
    }

    setPendingInvites(data || []);
  };

  const loadFriends = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          sender:profiles!friends_sender_id_fkey(username),
          receiver:profiles!friends_receiver_id_fkey(username)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')
        .returns<DatabaseFriend[]>();

      if (error) {
        console.error('Error loading friends:', error);
        return;
      }

      if (!data) return;

      const formattedFriends = data.map(friend => ({
        id: friend.id,
        username: user.id === friend.sender_id 
          ? friend.receiver.username 
          : friend.sender.username,
        status: friend.status,
        is_sender: user.id === friend.sender_id
      }));

      setFriends(formattedFriends);
      console.log('Loaded friends:', formattedFriends);
    } catch (err) {
      console.error('Error in loadFriends:', err);
    }
  };

  const inviteUser = async (friendUsername: string) => {
    if (!activeServer || !user) return;

    try {
      // Finde den Benutzer anhand des Benutzernamens
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', friendUsername)
        .single();

      if (userError) {
        console.error('Error finding user:', userError);
        alert('Benutzer konnte nicht gefunden werden');
        return;
      }

      if (!userData) {
        alert('Benutzer nicht gefunden');
        return;
      }

      // Prüfe, ob der Benutzer bereits Mitglied ist
      const { data: existingMember, error: memberError } = await supabase
        .from('server_members')
        .select('*')
        .eq('server_id', activeServer.id)
        .eq('user_id', userData.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error checking membership:', memberError);
        alert('Fehler beim Prüfen der Mitgliedschaft');
        return;
      }

      if (existingMember) {
        alert('Dieser Benutzer ist bereits Mitglied des Servers.');
        return;
      }

      // Prüfe, ob bereits eine Einladung existiert
      const { data: existingInvite, error: inviteError } = await supabase
        .from('server_invites')
        .select('*')
        .eq('server_id', activeServer.id)
        .eq('invitee_id', userData.id)
        .eq('status', 'pending')
        .single();

      if (inviteError && inviteError.code !== 'PGRST116') {
        console.error('Error checking invites:', inviteError);
        alert('Fehler beim Prüfen der Einladungen');
        return;
      }

      if (existingInvite) {
        alert('Dieser Benutzer hat bereits eine ausstehende Einladung.');
        return;
      }

      // Erstelle die Einladung
      const { error: createInviteError } = await supabase
        .from('server_invites')
        .insert({
          server_id: activeServer.id,
          inviter_id: user.id,
          invitee_id: userData.id,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (createInviteError) {
        console.error('Error creating invite:', createInviteError);
        alert('Fehler beim Erstellen der Einladung');
        return;
      }

      alert('Einladung wurde erfolgreich gesendet!');
      setShowInviteModal(false);
      loadPendingInvites();
    } catch (err) {
      console.error('Error in inviteUser:', err);
      alert('Ein unerwarteter Fehler ist aufgetreten');
    }
  };

  // Funktion zum Zurücksetzen des Unread-Counters
  const resetUnreadCount = (channelId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [channelId]: 0
    }));
  };

  // Modifizierte setActiveChannel Funktion
  const handleChannelClick = (channel: Channel) => {
    setActiveChannel(channel);
    resetUnreadCount(channel.id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      // Hole den Benutzernamen aus der profiles Tabelle
      const { data: userData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (!userData) {
        console.error('Could not fetch user data');
        return;
      }

      // Optimistisch die Nachricht zum UI hinzufügen
      const optimisticMessage: ChannelMessage = {
        id: crypto.randomUUID(), // Temporäre ID
        content: messageContent,
        user_id: user.id,
        created_at: new Date().toISOString(),
        profiles: {
          username: userData.username,
          avatar_url: userData.avatar_url || null
        }
      };

      setMessages(prev => [...prev, optimisticMessage]);
      
      // Immer nach unten scrollen bei eigenen Nachrichten, mit Verzögerung für DOM-Update
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTop = container.scrollHeight;
          // Setze shouldAutoScroll auf true, da wir jetzt am unteren Ende sind
          setShouldAutoScroll(true);
        }
      }, 100);

      // Nachricht in die Datenbank einfügen
      const { error } = await supabase
        .from('channel_messages')
        .insert({
          channel_id: activeChannel.id,
          user_id: user.id,
          content: messageContent,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error sending message:', error);
        // Bei Fehler die optimistische Nachricht entfernen
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        return;
      }

    } catch (err) {
      console.error('Error:', err);
    }
  };

  const uploadFile = async (file: File) => {
    if (!activeChannel || !user) return;
    
    setUploading(true);
    try {
      // Prüfe Dateigröße (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Datei darf nicht größer als 5MB sein');
      }

      // Generiere einen einzigartigen Dateinamen
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${activeChannel.id}/${fileName}`;

      // Lade die Datei hoch
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Hole die öffentliche URL
      const { data } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      // Hole den Benutzernamen
      const { data: userData } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('Could not fetch user data');
      }

      // Optimistische UI-Aktualisierung
      const optimisticMessage: ChannelMessage = {
        id: crypto.randomUUID(),
        content: `📎 ${file.name}`,
        user_id: user.id,
        created_at: new Date().toISOString(),
        profiles: {
          username: userData.username,
          avatar_url: userData.avatar_url || null
        },
        file_url: data.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      };

      setMessages(prev => [...prev, optimisticMessage]);
      
      // Sende die Nachricht mit der Datei
      const { error: messageError } = await supabase
        .from('channel_messages')
        .insert({
          channel_id: activeChannel.id,
          user_id: user.id,
          content: `📎 ${file.name}`,
          file_url: data.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        });

      if (messageError) throw messageError;

    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(error.message || 'Fehler beim Hochladen der Datei');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Fehler beim Herunterladen der Datei');
    }
  };

  const renderFilePreview = (message: ChannelMessage) => {
    if (!message.file_url || !message.file_type) return null;

    if (message.file_type.startsWith('image/')) {
      return (
        <img 
          src={message.file_url} 
          alt={message.file_name} 
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90"
          onClick={() => window.open(message.file_url, '_blank')}
        />
      );
    }

    if (message.file_type === 'text/plain') {
      return (
        <div className="max-w-xs p-3 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">{message.file_name}</span>
            <button
              onClick={() => message.file_url && downloadFile(message.file_url, message.file_name || 'file.txt')}
              className="text-blue-400 hover:text-blue-300"
            >
              ⬇️
            </button>
          </div>
          <div className="text-xs text-gray-400">
            {formatFileSize(message.file_size || 0)}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xs p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">{message.file_name}</span>
          <button
            onClick={() => message.file_url && downloadFile(message.file_url, message.file_name || 'file')}
            className="text-blue-400 hover:text-blue-300"
          >
            ⬇️
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatFileSize(message.file_size || 0)}
        </div>
      </div>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex">
      {/* Server Sidebar */}
      <div className="w-20 bg-gray-900 p-3 flex flex-col items-center space-y-3">
        {servers.map(server => (
          <button
            key={server.id}
            onClick={() => setActiveServer(server)}
            className={`w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center hover:bg-indigo-600 transition-colors
              ${activeServer?.id === server.id ? 'bg-indigo-600' : ''}`}
          >
            {server.icon_url ? (
              <img
                src={server.icon_url}
                alt={server.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold">
                {server.name.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        ))}

        <button
          onClick={() => setShowNewServerModal(true)}
          className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center hover:bg-green-600 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Channels Sidebar */}
      {activeServer && (
        <div className="w-60 bg-gray-800">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h1 className="font-bold truncate">{activeServer.name}</h1>
            {activeServer.owner_id === user?.id && (
              <button
                onClick={() => {
                  setServerSettings({
                    name: activeServer.name,
                    description: activeServer.description || '',
                    isPrivate: activeServer.is_private || false
                  });
                  setShowServerSettings(true);
                }}
                className="text-gray-400 hover:text-white"
              >
                <Settings size={18} />
              </button>
            )}
          </div>

          <div className="p-2">
            {/* Kategorie-Hinzufügen-Button */}
            {activeServer?.owner_id === user?.id && (
              <button
                onClick={() => setShowNewCategoryModal(true)}
                className="flex items-center gap-2 w-full px-2 py-1 mb-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <Plus size={16} />
                <span>Neue Kategorie</span>
              </button>
            )}

            {categories.map(category => (
              <div key={category.id} className="mb-2">
                <div className="flex items-center justify-between px-1 group">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-1 text-gray-400 hover:text-white text-sm uppercase font-semibold"
                  >
                    <ChevronDown
                      size={14}
                      className={`transform transition-transform ${
                        expandedCategories.has(category.id) ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    {category.name}
                  </button>
                  {activeServer?.owner_id === user?.id && (
                    <button
                      onClick={() => {
                        setNewChannelName('');
                        setNewChannelType('text');
                        setShowNewChannelModal(true);
                        // Speichere die aktuelle Kategorie-ID
                        setCurrentCategoryId(category.id);
                      }}
                      className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                {expandedCategories.has(category.id) && (
                  <div className="space-y-1 mt-1">
                    {channels
                      .filter(channel => channel.category_id === category.id)
                      .map(channel => (
                        <div key={channel.id} className="relative group">
                          <button
                            onClick={() => handleChannelClick(channel)}
                            className={`flex items-center gap-2 w-full px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded group ${
                              activeChannel?.id === channel.id ? 'bg-gray-700 text-white' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {channel.type === 'text' ? (
                                <Hash size={18} />
                              ) : (
                                <Volume2 size={18} />
                              )}
                              {channel.name}
                            </div>
                            {unreadCounts[channel.id] > 0 && (
                              <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                {unreadCounts[channel.id]}
                              </div>
                            )}
                          </button>
                          {activeServer?.owner_id === user?.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Channel-spezifische Aktionen
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white"
                            >
                              <Settings size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 bg-gray-700 flex flex-col h-screen overflow-hidden">
        {activeChannel?.type === 'text' ? (
          <>
            {/* Channel Header */}
            <div className="p-4 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center">
                <Hash size={24} className="text-gray-400 mr-2" />
                <div>
                  <h2 className="font-semibold text-white">{activeChannel.name}</h2>
                  <p className="text-sm text-gray-400">
                    Willkommen im Channel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMembersBar(!showMembersBar)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-hidden relative">
              <div
                ref={messagesContainerRef}
                className="h-full overflow-y-auto p-4 pb-20"
                onClick={() => setActiveDropdownId(null)}
              >
                {messages.map(message => (
                  <div key={message.id} className="flex items-start gap-4 group mb-4 min-h-[40px]">
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {message.profiles?.avatar_url ? (
                        <img 
                          src={message.profiles.avatar_url} 
                          alt={message.profiles?.username} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {message.profiles?.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 max-w-[calc(100%-120px)]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {message.profiles.username}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                        {message.user_id === user?.id && (
                          <div className="relative flex-shrink-0 ml-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === message.id ? null : message.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity p-1 rounded hover:bg-gray-700"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                              </svg>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {activeDropdownId === message.id && (
                              <div 
                                className="absolute left-0 top-6 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50"
                                onClick={(e) => e.stopPropagation()}
                                style={{ minWidth: '180px' }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.content);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 hover:text-white flex items-center gap-2"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                    </svg>
                                    Kopieren
                                  </button>
                                  <button
                                    onClick={() => {
                                      deleteMessage(message.id);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-700 hover:text-red-400 flex items-center gap-2"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18"></path>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Löschen
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-1">
                        {message.file_url ? (
                          renderFilePreview(message)
                        ) : (
                          <p className="text-gray-100 break-all whitespace-pre-wrap overflow-hidden">
                            {parseMessageContent(message.content)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scroll to Bottom Button */}
              <button
                onClick={scrollToBottom}
                className="absolute left-4 bottom-[72px] bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 shadow-lg opacity-80 hover:opacity-100 transition-opacity z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7 7 7-7"/>
                </svg>
              </button>

              {/* Message Input Area */}
              <div className="absolute bottom-0 left-0 right-0 bg-gray-700 border-t border-gray-600 p-4">
                <form onSubmit={sendMessage}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojis(!showEmojis)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Smile size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-gray-400 hover:text-white"
                      disabled={uploading}
                    >
                      <ImageIcon size={22} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file);
                      }}
                    />
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Nachricht an #${activeChannel?.name}`}
                      className="flex-1 bg-gray-600 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      disabled={!newMessage.trim()}
                    >
                      Senden
                    </button>
                  </div>
                  {showEmojis && (
                    <div className="absolute bottom-20 right-4">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => {
                          setNewMessage(prev => prev + emojiData.emoji);
                          setShowEmojis(false);
                        }}
                      />
                    </div>
                  )}
                </form>
              </div>
            </div>
          </>
        ) : activeChannel?.type === 'voice' ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-600 flex items-center justify-between">
              <div className="flex items-center">
                <Volume2 size={24} className="text-gray-400 mr-2" />
                <div>
                  <h2 className="font-semibold text-white">{activeChannel.name}</h2>
                  <p className="text-sm text-gray-400">Voice Channel</p>
                </div>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {user && <VoiceChat channelId={activeChannel.id} userId={user.id} channelName={activeChannel.name} />}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Wähle einen Channel aus</p>
          </div>
        )}
      </div>

      {/* Members Sidebar */}
      {showMembersBar && (
        <div className="w-60 bg-gray-800 border-l border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Mitglieder</h3>
              {activeServer?.owner_id === user?.id && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-gray-400 hover:text-white"
                >
                  <UserPlus size={18} />
                </button>
              )}
            </div>
            
            {/* Online Members */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2">
                ONLINE — {serverMembers.filter(member => onlineUsers[member.user_id]).length}
              </h4>
              <div className="space-y-2">
                {serverMembers
                  .filter(member => onlineUsers[member.user_id])
                  .map(member => (
                    <div key={member.user_id} className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                          {member.user.avatar_url ? (
                            <img 
                              src={member.user.avatar_url} 
                              alt={member.user.username} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-white">
                              {member.user.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {member.user.username}
                      </span>
                      {member.role === 'owner' && (
                        <span className="text-xs text-yellow-500">
                          👑
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Offline Members */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">
                OFFLINE — {serverMembers.filter(member => !onlineUsers[member.user_id]).length}
              </h4>
              <div className="space-y-2">
                {serverMembers
                  .filter(member => !onlineUsers[member.user_id])
                  .map(member => (
                    <div key={member.user_id} className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center opacity-70">
                          <span className="text-sm font-bold text-white">
                            {member.user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-gray-800"></div>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {member.user.username}
                      </span>
                      {member.role === 'owner' && (
                        <span className="text-xs text-yellow-500">
                          👑
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Server Modal */}
      {showNewServerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create New Server</h2>
            <form onSubmit={createServer}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded"
                    placeholder="My Awesome Server"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewServerModal(false)}
                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
                  >
                    Create Server
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Channel Modal */}
      {showNewChannelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Neuen Channel erstellen</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              createChannel();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full p-2 bg-gray-700 rounded"
                    placeholder="new-channel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Channel Typ
                  </label>
                  <select
                    value={newChannelType}
                    onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice')}
                    className="w-full p-2 bg-gray-700 rounded"
                  >
                    <option value="text">Text Channel</option>
                    <option value="voice">Voice Channel</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewChannelModal(false)}
                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
                    disabled={!newChannelName.trim()}
                  >
                    Erstellen
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Server Settings Modal */}
      {showServerSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-[480px]">
            <h2 className="text-xl font-bold mb-6">Server Einstellungen</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateServer();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={serverSettings.name}
                    onChange={(e) => setServerSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2 bg-gray-700 rounded"
                    placeholder="Mein Server"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={serverSettings.description}
                    onChange={(e) => setServerSettings(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 bg-gray-700 rounded h-24 resize-none"
                    placeholder="Beschreibe deinen Server..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={serverSettings.isPrivate}
                    onChange={(e) => setServerSettings(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="rounded bg-gray-700"
                  />
                  <label htmlFor="isPrivate" className="text-sm">
                    Privater Server
                  </label>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h3 className="text-lg font-medium mb-2">Gefahrenzone</h3>
                  <button
                    type="button"
                    onClick={deleteServer}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Server löschen
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowServerSettings(false)}
                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Freunde einladen</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {friends.map(friend => {
                const isAlreadyMember = serverMembers.some(
                  member => member.user.username === friend.username
                );
                const hasPendingInvite = pendingInvites.some(
                  invite => invite.inviter.username === friend.username
                );

                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {friend.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white">{friend.username}</span>
                    </div>
                    
                    {isAlreadyMember ? (
                      <span className="text-sm text-gray-400">Bereits Mitglied</span>
                    ) : hasPendingInvite ? (
                      <span className="text-sm text-gray-400">Einladung ausstehend</span>
                    ) : (
                      <button
                        onClick={() => inviteUser(friend.username)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        Einladen
                      </button>
                    )}
                  </div>
                );
              })}
              
              {friends.length === 0 && (
                <p className="text-center text-gray-400 py-4">
                  Keine Freunde gefunden
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Neue Kategorie Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Neue Kategorie erstellen</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              createCategory();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Kategorie Name
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded"
                    placeholder="NEUE KATEGORIE"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryModal(false)}
                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
                    disabled={!newCategoryName.trim()}
                  >
                    Erstellen
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Channels;