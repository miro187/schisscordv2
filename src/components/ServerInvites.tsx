import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Check, X } from 'lucide-react';

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
        // Akzeptiere die Einladung
        const { data: invite } = await supabase
          .from('server_invites')
          .select('server_id')
          .eq('id', inviteId)
          .single();

        if (invite) {
          // Füge den Benutzer als Mitglied hinzu
          await supabase
            .from('server_members')
            .insert({
              server_id: invite.server_id,
              user_id: user?.id,
              role: 'member'
            });
        }
      }

      // Lösche die Einladung
      await supabase
        .from('server_invites')
        .delete()
        .eq('id', inviteId);

      // Aktualisiere die Einladungsliste
      loadInvites();
    } catch (err) {
      console.error('Error handling invite:', err);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      {invites.map(invite => (
        <div
          key={invite.id}
          className="bg-gray-800 rounded-lg shadow-lg p-4 mb-2 animate-slide-in"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-white">
                Servereinladung
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                {invite.inviter.username} lädt dich ein, dem Server "{invite.server.name}" beizutreten
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => handleInvite(invite.id, false)}
              className="p-2 text-gray-400 hover:text-red-500 rounded"
            >
              <X size={20} />
            </button>
            <button
              onClick={() => handleInvite(invite.id, true)}
              className="p-2 text-gray-400 hover:text-green-500 rounded"
            >
              <Check size={20} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ServerInvites; 