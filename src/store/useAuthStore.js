import { create } from 'zustand';
import { supabaseAuth, getSupabaseClient } from '../lib/supabase';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAdmin: false,
  loading: true,

  init: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ loading: false });
      return;
    }

    // Check active session
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    
    set({ 
      user, 
      isAdmin: user?.email === 'its.n04h2005@gmail.com',
      loading: false 
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      set({ 
        user: u, 
        isAdmin: u?.email === 'its.n04h2005@gmail.com' 
      });
    });
  },

  login: async (email, password) => {
    const { data, error } = await supabaseAuth.signIn(email, password);
    if (error) throw new Error(error.message || error);
    return data;
  },

  register: async (email, password) => {
    const { data, error } = await supabaseAuth.signUp(email, password);
    if (error) throw new Error(error.message || error);
    return data;
  },

  logout: async () => {
    await supabaseAuth.signOut();
    set({ user: null, isAdmin: false });
  },
}));
