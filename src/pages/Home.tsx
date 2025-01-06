import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface Friend {
  id: string
  username: string
  status: string
}

export default function Home() {
  const { user } = useAuth()
  const [onlineFriends, setOnlineFriends] = useState<Friend[]>([])

  const fetchFriends = async () => {
    if (!user) return;

    const { data: friends, error } = await supabase
      .from('friends')
      .select(`
        id,
        sender:profiles!friends_sender_id_fkey (
          id,
          username,
          status,
          last_seen
        ),
        receiver:profiles!friends_receiver_id_fkey (
          id,
          username,
          status,
          last_seen
        )
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }

    if (!friends) return;

    const onlineFriendsList = friends.map(friendship => {
      const friend = friendship.sender.id === user.id 
        ? friendship.receiver 
        : friendship.sender;
      
      const lastSeen = new Date(friend.last_seen);
      const isActive = new Date().getTime() - lastSeen.getTime() < 3000;
      
      return {
        id: friend.id,
        username: friend.username,
        status: isActive && friend.status === 'online' ? 'online' : 'offline'
      };
    }).filter(friend => friend.status === 'online');

    setOnlineFriends(onlineFriendsList);
  };

  useEffect(() => {
    if (!user) return;

    fetchFriends();

    // Echtzeit-Updates für Profiländerungen
    const channel = supabase
      .channel('online-friends')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        fetchFriends
      )
      .subscribe();

    // Häufigeres Update der Freundesliste (alle 2 Sekunden)
    const updateInterval = setInterval(fetchFriends, 2000);

    return () => {
      channel.unsubscribe();
      clearInterval(updateInterval);
    }
  }, [user]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Welcome back!</h1>
      
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <h2 className="text-xl">Online Friends</h2>
        </div>

        {onlineFriends.length === 0 ? (
          <p className="text-gray-400">No friends online</p>
        ) : (
          <ul className="space-y-2">
            {onlineFriends.map((friend) => (
              <li key={friend.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>{friend.username}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}