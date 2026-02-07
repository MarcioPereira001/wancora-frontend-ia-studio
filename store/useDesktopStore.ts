
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppType = 'drive' | 'editor' | 'preview' | 'sheet'; 

export interface WindowInstance {
  id: string;
  type: AppType;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
  data?: any;
  internalState?: any;
  isDirty?: boolean;
}

interface DesktopState {
  windows: WindowInstance[];
  activeWindowId: string | null;
  nextZIndex: number;
  wallpaper: string;

  openWindow: (type: AppType, title: string, data?: any) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  centerWindow: (id: string) => void; 
  setWindowState: (id: string, state: any) => void;
  setWindowDirty: (id: string, isDirty: boolean) => void;
  setWallpaper: (url: string) => void;
}

export const useDesktopStore = create<DesktopState>()(
  persist(
    (set, get) => ({
      windows: [],
      activeWindowId: null,
      nextZIndex: 100,
      // Padrão alterado para "System Grid" conforme solicitado
      wallpaper: 'https://image2url.com/r2/default/images/1770448285254-8dec4bd3-00a3-4f9b-9b36-8fa2764bd621.png',

      setWallpaper: (url) => set({ wallpaper: url }),

      openWindow: (type, title, data) => {
        const currentWindows = get().windows;

        if (type === 'drive') {
            const existingDrive = currentWindows.find(w => w.type === 'drive' && w.title === title);
            if (existingDrive) {
                get().focusWindow(existingDrive.id);
                return;
            }
        }

        if (type === 'editor' || type === 'sheet') {
            const apps = currentWindows.filter(w => w.type === 'editor' || w.type === 'sheet');
            if (apps.length >= 3) {
                alert("Limite de 3 apps simultâneos atingido.");
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
          position: { x: 100 + (currentWindows.length * 20), y: 50 + (currentWindows.length * 20) },
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

      centerWindow: (id) => {
          set((state) => ({
              windows: state.windows.map(w => w.id === id ? { 
                  ...w, 
                  isMinimized: false,
                  isMaximized: false,
                  position: { x: 100, y: 50 }, 
                  zIndex: state.nextZIndex + 1
              } : w),
              activeWindowId: id,
              nextZIndex: state.nextZIndex + 1
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
    }),
    {
      name: 'desktop-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ wallpaper: state.wallpaper }) // Apenas persiste o wallpaper
    }
  )
);
