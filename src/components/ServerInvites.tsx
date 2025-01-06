import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ServerInvite {
  id: string;
  server_id: string;
  inviter_id: string;
  server: {
    name: string;
  };
  inviter: {
    username: string;
  };
}

const ServerInvites = () => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<ServerInvite[]>([]);

  useEffect(() => {
    if (user) {
      loadInvites();
      subscribeToInvites();
    }
    return () => {
      supabase.channel('server-invites').unsubscribe();
    };
  }, [user]);

  const loadInvites = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('server_invites')
      .select('*, server:servers(name), inviter:profiles!inviter_id(username)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error loading invites:', error);
      return;
    }

    setInvites(data || []);
  };

  const subscribeToInvites = () => {
    if (!user) return;

    supabase
      .channel('server-invites')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'server_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        () => {
          loadInvites();
        }
      )
      .subscribe();
  };

  const handleInvite = async (inviteId: string, accept: boolean) => {
    try {
      if (accept) {
        const { data: invite } = await supabase
          .from('server_invites')
          .select('server_id')
          .eq('id', inviteId)
          .single();

        if (invite) {
          await supabase
            .from('server_members')
            .insert({
              server_id: invite.server_id,
              user_id: user?.id,
              role: 'member'
            });
        }
      }

      await supabase
        .from('server_invites')
        .delete()
        .eq('id', inviteId);

      setInvites(prev => prev.filter(invite => invite.id !== inviteId));
    } catch (err) {
      console.error('Error handling invite:', err);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 space-y-2">
      <AnimatePresence>
        {invites.map(invite => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <motion.h3 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent"
                  >
                    Servereinladung
                  </motion.h3>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-sm text-gray-300 mt-1"
                  >
                    <span className="font-medium text-indigo-400">{invite.inviter.username}</span> lädt dich ein, dem Server <span className="font-medium text-purple-400">"{invite.server.name}"</span> beizutreten
                  </motion.p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleInvite(invite.id, false)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleInvite(invite.id, true)}
                  className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                >
                  <Check size={20} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ServerInvites; 