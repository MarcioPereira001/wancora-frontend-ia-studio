
import { create } from 'zustand';

export type AppType = 'drive' | 'editor' | 'preview';

export interface WindowInstance {
  id: string;
  type: AppType;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
  data?: any; // Dados extras (arquivo para preview, folderId, etc)
  internalState?: any; // Persistência local (ex: conteúdo do editor não salvo)
  isDirty?: boolean; // Se tem alterações não salvas
}

interface DesktopState {
  windows: WindowInstance[];
  activeWindowId: string | null;
  nextZIndex: number;

  openWindow: (type: AppType, title: string, data?: any) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  
  // New Actions
  setWindowState: (id: string, state: any) => void;
  setWindowDirty: (id: string, isDirty: boolean) => void;
}

export const useDesktopStore = create<DesktopState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: 100,

  openWindow: (type, title, data) => {
    const currentWindows = get().windows;

    // Limite de Editores (Performance & UX)
    if (type === 'editor') {
        const editors = currentWindows.filter(w => w.type === 'editor');
        if (editors.length >= 3) {
            alert("Muitos editores abertos. Feche um para abrir outro.");
            return;
        }
    }

    const id = `${type}-${Date.now()}`;
    const newWindow: WindowInstance = {
      id,
      type,
      title,
      isMinimized: false,
      isMaximized: false,
      zIndex: get().nextZIndex + 1,
      // Posição inicial em cascata para não sobrepor totalmente
      position: { x: 50 + (currentWindows.length * 30), y: 50 + (currentWindows.length * 30) },
      size: { width: 900, height: 600 },
      data,
      internalState: null,
      isDirty: false
    };

    set((state) => ({
      windows: [...state.windows, newWindow],
      activeWindowId: id,
      nextZIndex: state.nextZIndex + 1
    }));
  },

  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId
    }));
  },

  focusWindow: (id) => {
    set((state) => {
      if (state.activeWindowId === id) return state;

      const newZ = state.nextZIndex + 1;
      return {
        activeWindowId: id,
        nextZIndex: newZ,
        windows: state.windows.map((w) => 
          w.id === id ? { ...w, zIndex: newZ, isMinimized: false } : w
        )
      };
    });
  },

  toggleMinimize: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => 
        w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
      )
    }));
  },

  toggleMaximize: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => 
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      )
    }));
  },

  updateWindowPosition: (id, x, y) => {
      set((state) => ({
          windows: state.windows.map(w => w.id === id ? { ...w, position: { x, y } } : w)
      }))
  },

  setWindowState: (id, internalState) => {
      set((state) => ({
          windows: state.windows.map(w => w.id === id ? { ...w, internalState } : w)
      }))
  },

  setWindowDirty: (id, isDirty) => {
      set((state) => ({
          windows: state.windows.map(w => w.id === id ? { ...w, isDirty } : w)
      }))
  }
}));
