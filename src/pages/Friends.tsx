import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import Chat from '../components/Chat';

interface Friend {
  id: string;
  username: string;
  status: 'online' | 'offline';
}

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    username: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
}

const Friends = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [error, setError] = useState('');
  const [activeChatFriend, setActiveChatFriend] = useState<Friend | null>(null);
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadFriendRequests();
    }
  }, [user]);

  const loadFriends = async () => {
    // Lade Freundschaften, bei denen der User Sender ist
    const { data: sentFriends } = await supabase
      .from('friends')
      .select(`
        id,
        receiver:profiles!friends_receiver_id_fkey (
          id,
          username,
          status,
          last_seen
        )
      `)
      .eq('sender_id', user?.id)
      .eq('status', 'accepted');

    // Lade Freundschaften, bei denen der User Empfänger ist
    const { data: receivedFriends } = await supabase
      .from('friends')
      .select(`
        id,
        sender:profiles!friends_sender_id_fkey (
          id,
          username,
          status,
          last_seen
        )
      `)
      .eq('receiver_id', user?.id)
      .eq('status', 'accepted');

    if (!sentFriends && !receivedFriends) return;

    // Kombiniere beide Listen
    const allFriends = [
      ...(sentFriends?.map(f => {
        const lastSeen = new Date(f.receiver.last_seen);
        const isActive = new Date().getTime() - lastSeen.getTime() < 3000;
        return {
          id: f.receiver.id,
          username: f.receiver.username,
          status: isActive && f.receiver.status === 'online' ? 'online' : 'offline'
        };
      }) || []),
      ...(receivedFriends?.map(f => {
        const lastSeen = new Date(f.sender.last_seen);
        const isActive = new Date().getTime() - lastSeen.getTime() < 3000;
        return {
          id: f.sender.id,
          username: f.sender.username,
          status: isActive && f.sender.status === 'online' ? 'online' : 'offline'
        };
      }) || [])
    ];

    setFriends(allFriends);
  };

  // Echtzeit-Updates für Freunde-Status
  useEffect(() => {
    if (!user) return;

    // Initiales Laden
    loadFriends();

    // Echtzeit-Updates
    const channel = supabase
      .channel('friends-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        loadFriends
      )
      .subscribe();

    // Regelmäßiges Update
    const updateInterval = setInterval(loadFriends, 2000);

    return () => {
      channel.unsubscribe();
      clearInterval(updateInterval);
    };
  }, [user]);

  const loadFriendRequests = async () => {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        sender:profiles!friends_sender_id_fkey (
          id,
          username
        )
      `)
      .eq('receiver_id', user?.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error loading requests:', error);
      return;
    }

    if (data) {
      setRequests(data.map(request => ({
        id: request.id,
        sender: {
          id: request.sender.id,
          username: request.sender.username
        },
        status: 'pending' as const
      })));
    }
  };

  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newFriendUsername.trim()) {
      setError('Bitte geben Sie einen Benutzernamen ein');
      return;
    }

    // Benutzer mit Username finden
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', newFriendUsername.trim())
      .single();

    if (userError || !userData) {
      setError('Benutzer nicht gefunden');
      return;
    }

    if (userData.id === user?.id) {
      setError('Sie können sich nicht selbst als Freund hinzufügen');
      return;
    }

    // Prüfen ob bereits eine Anfrage existiert
    const { data: existingRequest } = await supabase
      .from('friends')
      .select('id')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${userData.id}),and(sender_id.eq.${userData.id},receiver_id.eq.${user?.id})`)
      .single();

    if (existingRequest) {
      setError('Es existiert bereits eine Freundschaftsverbindung oder Anfrage');
      return;
    }

    // Freundschaftsanfrage senden
    const { error: requestError } = await supabase
      .from('friends')
      .insert({
        sender_id: user?.id,
        receiver_id: userData.id,
        status: 'pending'
      });

    if (requestError) {
      console.error('Error sending request:', requestError);
      setError('Fehler beim Senden der Anfrage');
      return;
    }

    setNewFriendUsername('');
  };

  const handleRequest = async (requestId: string, accept: boolean) => {
    // Update den Status in der friends Tabelle
    const { error } = await supabase
      .from('friends')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', requestId);

    if (error) {
      console.error('Error handling request:', error);
      return;
    }

    // Lade beide Listen neu
    await Promise.all([
      loadFriendRequests(),
      loadFriends()
    ]);
  };

  const handleServerInvite = async (message: any) => {
    if (!user) return;

    try {
      // Füge den Benutzer als Server-Mitglied hinzu
      const { error: memberError } = await supabase
        .from('server_members')
        .insert({
          server_id: message.server_id,
          user_id: user.id,
          role: 'member'
        });

      if (memberError) throw memberError;

      // Lösche die Einladungsnachricht
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (deleteError) throw deleteError;

    } catch (err) {
      console.error('Error handling server invite:', err);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Freunde</h2>
      
      {/* Freund hinzufügen */}
      <form onSubmit={sendFriendRequest} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newFriendUsername}
            onChange={(e) => setNewFriendUsername(e.target.value)}
            placeholder="Benutzername"
            className="flex-1 p-2 rounded bg-gray-700 text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Anfrage senden
          </button>
        </div>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>

      {/* Freundschaftsanfragen */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Freundschaftsanfragen</h3>
          <div className="space-y-2">
            {requests.map(request => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded"
              >
                <span className="text-white">{request.sender.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(request.id, true)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Annehmen
                  </button>
                  <button
                    onClick={() => handleRequest(request.id, false)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Freundesliste */}
      <div className="space-y-2">
        {friends.map(friend => (
          <div key={friend.id} className="flex flex-col">
            {/* Freund-Header */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-white">{friend.username}</span>
              </div>
              <button
                onClick={() => setExpandedChatId(expandedChatId === friend.id ? null : friend.id)}
                className={`px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors
                  ${expandedChatId === friend.id ? 'bg-indigo-700' : ''}`}
              >
                Chat
              </button>
            </div>

            {/* Chat-Container mit Animation */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out flex justify-center
              ${expandedChatId === friend.id ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
            >
              {expandedChatId === friend.id && (
                <Chat
                  friendId={friend.id}
                  friendUsername={friend.username}
                  onClose={() => setExpandedChatId(null)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Friends;