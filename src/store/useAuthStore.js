import { create } from 'zustand';
import pb from '../lib/pb'; // We will create this

export const useAuthStore = create((set) => ({
  user: pb.authStore.model,
  isAdmin: pb.authStore.model?.email === 'its.n04h2005@gmail.com',

  login: async (email, password) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    set({ user: authData.record, isAdmin: authData.record.email === 'its.n04h2005@gmail.com' });
    return authData;
  },

  register: async (email, password, passwordConfirm) => {
    const record = await pb.collection('users').create({
      email,
      password,
      passwordConfirm
    });
    // Auto-login after registration
    const authData = await pb.collection('users').authWithPassword(email, password);
    set({ user: authData.record, isAdmin: authData.record.email === 'its.n04h2005@gmail.com' });
    return authData;
  },

  logout: () => {
    pb.authStore.clear();
    set({ user: null, isAdmin: false });
  },

  updateUser: () => {
    set({ 
      user: pb.authStore.model, 
      isAdmin: pb.authStore.model?.email === 'its.n04h2005@gmail.com' 
    });
  }
}));
