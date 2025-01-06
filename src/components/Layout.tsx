import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

const Layout = () => {
  const { user } = useAuth();

  // Online-Status Management
  useEffect(() => {
    if (!user) return;

    const updateOnlineStatus = async () => {
      await supabase
        .from('profiles')
        .update({ 
          status: 'online',
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
    }

    const setOfflineStatus = async () => {
      await supabase
        .from('profiles')
        .update({ 
          status: 'offline',
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
    }

    // Initial online Status
    updateOnlineStatus();

    // Häufigeres Update des Online-Status (alle 2 Sekunden)
    const pingInterval = setInterval(async () => {
      await updateOnlineStatus();
    }, 2000);

    // Offline-Status beim Verlassen der Seite
    const handleBeforeUnload = () => {
      setOfflineStatus();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      clearInterval(pingInterval);
      setOfflineStatus();
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex h-full w-full"
      >
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-gray-800/50 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
};

export default Layout;