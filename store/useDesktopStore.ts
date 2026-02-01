
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
}

export const useDesktopStore = create<DesktopState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: 100,

  openWindow: (type, title, data) => {
    const id = `${type}-${Date.now()}`;
    const newWindow: WindowInstance = {
      id,
      type,
      title,
      isMinimized: false,
      isMaximized: false,
      zIndex: get().nextZIndex + 1,
      position: { x: 50 + (get().windows.length * 20), y: 50 + (get().windows.length * 20) },
      size: { width: 900, height: 600 },
      data
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
      // Se já é a ativa, não faz nada (otimização)
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
  }
}));
