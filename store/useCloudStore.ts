
import { create } from 'zustand';
import { DriveFile } from '@/types';
import { api } from '@/services/api';
import { useAuthStore } from './useAuthStore';

interface CloudState {
  currentFolderId: string | null;
  folderHistory: {id: string | null, name: string}[]; // Breadcrumbs
  files: DriveFile[];
  isLoading: boolean;
  selectedFileIds: Set<string>;
  clipboard: { op: 'copy' | 'cut', files: DriveFile[] } | null;

  // Actions
  navigateTo: (folderId: string | null, folderName: string) => void;
  navigateUp: () => void;
  fetchFiles: (folderId?: string | null) => Promise<void>;
  toggleSelection: (id: string, multi: boolean) => void;
  clearSelection: () => void;
  uploadFile: (file: File) => Promise<void>;
}

export const useCloudStore = create<CloudState>((set, get) => ({
  currentFolderId: null,
  folderHistory: [{ id: null, name: 'Meu Drive' }],
  files: [],
  isLoading: false,
  selectedFileIds: new Set(),
  clipboard: null,

  navigateTo: (folderId, folderName) => {
      const history = get().folderHistory;
      if (folderId === get().currentFolderId) return;
      
      set({ 
          currentFolderId: folderId,
          folderHistory: [...history, { id: folderId, name: folderName }],
          selectedFileIds: new Set()
      });
      get().fetchFiles(folderId);
  },

  navigateUp: () => {
      const history = get().folderHistory;
      if (history.length <= 1) return;

      const newHistory = history.slice(0, -1);
      const parent = newHistory[newHistory.length - 1];
      
      set({ 
          currentFolderId: parent.id, 
          folderHistory: newHistory,
          selectedFileIds: new Set() 
      });
      get().fetchFiles(parent.id);
  },

  fetchFiles: async (folderIdInput) => {
      const companyId = useAuthStore.getState().user?.company_id;
      const folderId = folderIdInput !== undefined ? folderIdInput : get().currentFolderId;

      if (!companyId) return;

      set({ isLoading: true });
      try {
          const queryString = folderId ? `?folderId=${folderId}` : '';
          const res = await api.post(`/cloud/google/list${queryString}`, { companyId });
          
          set({ files: res.files || [] });
      } catch (error) {
          console.error("Erro ao listar arquivos:", error);
      } finally {
          set({ isLoading: false });
      }
  },

  toggleSelection: (id, multi) => {
      const current = new Set(multi ? get().selectedFileIds : []);
      if (current.has(id)) {
          if (multi) current.delete(id);
          else current.clear();
      } else {
          current.add(id);
      }
      set({ selectedFileIds: current });
  },

  clearSelection: () => set({ selectedFileIds: new Set() }),

  uploadFile: async (file) => {
      const companyId = useAuthStore.getState().user?.company_id;
      if (!companyId) throw new Error("Empresa não identificada");
      
      // Converte para Base64 para enviar via JSON (evita complexidade de multipart no backend atual)
      return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
              try {
                  const base64 = (reader.result as string).split(',')[1];
                  
                  await api.post('/cloud/google/upload', {
                      companyId,
                      name: file.name,
                      mimeType: file.type,
                      base64,
                      folderId: get().currentFolderId
                  });
                  
                  // Refresh após upload
                  get().fetchFiles();
                  resolve();
              } catch (e) {
                  reject(e);
              }
          };
          reader.onerror = error => reject(error);
      });
  }
}));
