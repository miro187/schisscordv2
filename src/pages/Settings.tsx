import { useAuth } from '../lib/auth';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Settings = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState('');

  useEffect(() => {
    async function fetchUsername() {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching username:', error);
          return;
        }
        
        if (data) {
          setUsername(data.username);
        } else {
          console.log('No data found for user:', user.id);
        }
      }
    }
    
    fetchUsername();
  }, [user]);

  return (
    <div className="p-6 max-w-md mx-auto bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-white mb-6">Benutzereinstellungen</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400">
            Benutzername
          </label>
          <div className="mt-1 p-2 bg-gray-700 rounded-md text-white">
            {username}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400">
            Email
          </label>
          <div className="mt-1 p-2 bg-gray-700 rounded-md text-white">
            {user?.email}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;