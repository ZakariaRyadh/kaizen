import { create } from 'zustand';

import { apiLogin, apiLogout, apiRegister, getMe } from '../services/api';
import { getAccessToken } from '../services/storage';

type User = { id: number; email: string; display_name: string } | null;

type AuthState = {
  ready: boolean;        // finished the initial token check
  isLoggedIn: boolean;
  user: User;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  ready: false,
  isLoggedIn: false,
  user: null,
  error: null,

  // run once on app start: do we already have a valid session?
  checkAuth: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ ready: true, isLoggedIn: false });
      return;
    }
    try {
      const user = await getMe();
      set({ ready: true, isLoggedIn: true, user });
    } catch {
      set({ ready: true, isLoggedIn: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const data = await apiLogin(email, password);
      set({ isLoggedIn: true, user: data.user ?? null });
    } catch {
      set({ error: 'Invalid email or password' });
      throw new Error('login failed');
    }
  },

  register: async (email, password, displayName) => {
    set({ error: null });
    try {
      const data = await apiRegister(email, password, displayName);
      set({ isLoggedIn: true, user: data.user ?? null });
    } catch (e: any) {
      set({ error: 'Could not create account (email may be taken)' });
      throw e;
    }
  },

  logout: async () => {
    await apiLogout();
    set({ isLoggedIn: false, user: null });
  },
}));
