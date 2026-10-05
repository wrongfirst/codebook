import { createStore } from 'zustand/vanilla';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tier: 'free' | 'pro';
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  checkAuth: () => Promise<User | null>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = createStore<AuthState>((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json() as { user: User | null };
        set({ user: data.user, isLoading: false });
        return data.user;
      }
      set({ user: null, isLoading: false });
      return null;
    } catch (err) {
      console.warn('[Auth] Failed to check auth session:', err);
      set({ user: null, isLoading: false });
      return null;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('[Auth] Logout request failed:', err);
    } finally {
      set({ user: null });
      window.location.reload();
    }
  },

  setUser: (user) => set({ user }),
}));
