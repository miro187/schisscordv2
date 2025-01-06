import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

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
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;