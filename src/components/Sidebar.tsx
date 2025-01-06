import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Users, Settings, LogOut, Music } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { motion } from 'framer-motion';

const Sidebar = () => {
  const { signOut } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: MessageSquare, label: 'Channels', to: '/channels' },
    { icon: Users, label: 'Friends', to: '/friends' },
    { icon: Music, label: 'Music', to: '/music' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-16 bg-gray-800/50 backdrop-blur-xl border-r border-gray-700/50 flex flex-col items-center py-4"
    >
      <motion.div 
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <MessageSquare className="w-8 h-8 text-indigo-500" />
      </motion.div>

      <div className="space-y-4">
        {navItems.map(({ icon: Icon, label, to }, index) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * (index + 1) }}
          >
            <NavLink
              to={to}
              className={({ isActive }) =>
                `p-3 rounded-xl flex items-center justify-center transition-all duration-200 group ${
                  isActive 
                    ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' 
                    : 'hover:bg-gray-700/50 hover:shadow-lg hover:scale-110'
                }`
              }
              title={label}
            >
              <Icon className="w-6 h-6 transition-transform group-hover:scale-110" />
            </NavLink>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-auto"
      >
        <button
          onClick={signOut}
          className="p-3 rounded-xl hover:bg-red-500/20 transition-all duration-200 hover:scale-110 group"
          title="Logout"
        >
          <LogOut className="w-6 h-6 text-red-500 transition-transform group-hover:scale-110" />
        </button>
      </motion.div>
    </motion.div>
  );
};

export default Sidebar;