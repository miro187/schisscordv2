import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

const Sidebar = () => {
  const { signOut } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: MessageSquare, label: 'Channels', to: '/channels' },
    { icon: Users, label: 'Friends', to: '/friends' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <div className="w-16 bg-gray-800 flex flex-col items-center py-4">
      {navItems.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `p-3 rounded-xl mb-2 transition-colors ${
              isActive ? 'bg-indigo-600' : 'hover:bg-gray-700'
            }`
          }
          title={label}
        >
          <Icon className="w-6 h-6" />
        </NavLink>
      ))}
      <div className="mt-auto">
        <button
          onClick={signOut}
          className="p-3 rounded-xl hover:bg-gray-700 transition-colors"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;