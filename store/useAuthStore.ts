import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Company } from '@/types';

interface AuthState {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      isLoading: true,

      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () => set({ user: null, company: null, isLoading: false }),
    }),
    {
      name: 'wancora-auth-storage', // Nome único no localStorage
      storage: createJSONStorage(() => localStorage), // Persistência explícita
      partialize: (state) => ({ user: state.user, company: state.company }), // Não persistir isLoading
    }
  )
);