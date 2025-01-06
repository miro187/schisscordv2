import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'

interface Friend {
  id: string
  username: string
  status: string
}

interface FriendshipProfile {
  id: string
  username: string
  status: string
  last_seen: string
}

interface Friendship {
  id: string
  sender: FriendshipProfile
  receiver: FriendshipProfile
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
      .eq('status', 'accepted')
      .returns<Friendship[]>();

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

    const updateInterval = setInterval(fetchFriends, 2000);

    return () => {
      channel.unsubscribe();
      clearInterval(updateInterval);
    }
  }, [user]);

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          Welcome back!
        </h1>
        <p className="text-gray-400 mb-8">Here's what's happening with your friends</p>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/10 rounded-xl">
            <Users className="w-6 h-6 text-indigo-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">Online Friends</h2>
        </div>

        {onlineFriends.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 text-center py-8"
          >
            No friends online right now
          </motion.p>
        ) : (
          <div className="space-y-3">
            {onlineFriends.map((friend, index) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-700/30 hover:bg-gray-700/50 transition-colors group"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-lg font-bold text-white group-hover:scale-110 transition-transform">
                    {friend.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                </div>
                <span className="text-gray-200 font-medium">{friend.username}</span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}