import { create } from 'zustand';
import { supabase } from './supabase';

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  status?: string;
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useProfile = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,
  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .single();

      if (error) throw error;
      set({ profile });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateProfile: async (updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', supabase.auth.getUser().then(({ data }) => data.user?.id));

      if (error) throw error;
      set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
      }));
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));