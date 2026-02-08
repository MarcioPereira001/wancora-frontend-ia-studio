
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Company } from '@/types';

interface AuthState {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  hasHydrated: boolean; // NOVO: Controle de Hidratação
  
  // Actions
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (state: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      isLoading: true,
      hasHydrated: false, // Inicia false

      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setLoading: (loading) => set({ isLoading: loading }),
      setHydrated: (state) => set({ hasHydrated: state }),
      
      logout: () => {
          // Limpeza Total (Deep Clean)
          set({ user: null, company: null, isLoading: false });
          // Remove itens específicos do LocalStorage para evitar fantasmas
          if (typeof window !== 'undefined') {
            localStorage.removeItem('wancora-auth-storage');
            localStorage.removeItem('wancora-crm-storage');
            localStorage.removeItem('sb-access-token'); // Limpa token do supabase
          }
      },
    }),
    {
      name: 'wancora-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, company: state.company }), 
      onRehydrateStorage: () => (state) => {
          // Quando terminar de ler do disco, avisa a UI que pode renderizar
          state?.setHydrated(true);
      }
    }
  )
);
