import { create } from 'zustand';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ 
        user: session?.user ?? null, 
        loading: false,
        isAuthenticated: !!session?.user
      });
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ 
          user: session?.user ?? null,
          isAuthenticated: !!session?.user
        });
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false, isAuthenticated: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));