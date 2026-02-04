
import { create } from 'zustand';
import { DriveFile } from '@/types';
import { api } from '@/services/api'; 
import { useAuthStore } from './useAuthStore';
import { BACKEND_URL } from '../config';

export type ViewMode = 'list' | 'grid-sm' | 'grid-md' | 'grid-lg';

interface CloudState {
  currentFolderId: string | null;
  folderHistory: {id: string | null, name: string}[]; 
  files: DriveFile[];
  isLoading: boolean;
  selectedFileIds: Set<string>;
  clipboard: { op: 'copy' | 'cut', files: DriveFile[] } | null;
  
  viewMode: ViewMode;
  storageQuota: { usage: number, limit: number } | null;
  isTrashView: boolean; // NOVO: Flag para saber se está na lixeira

  // Actions
  navigateTo: (folderId: string | null, folderName: string) => void;
  navigateUp: () => void;
  fetchFiles: (folderId?: string | null) => Promise<void>;
  toggleSelection: (id: string, multi: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  uploadFile: (file: File) => Promise<void>;
  
  // New Actions
  fetchQuota: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  syncNow: () => Promise<void>;
  setTrashView: (isTrash: boolean) => void;
}

export const useCloudStore = create<CloudState>((set, get) => ({
  currentFolderId: null,
  folderHistory: [{ id: null, name: 'Meu Drive' }],
  files: [],
  isLoading: false,
  selectedFileIds: new Set(),
  clipboard: null,
  viewMode: 'grid-md',
  storageQuota: null,
  isTrashView: false,

  setTrashView: (isTrash) => {
      set({ 
          isTrashView: isTrash, 
          currentFolderId: null, 
          folderHistory: [{ id: null, name: isTrash ? 'Lixeira' : 'Meu Drive' }],
          selectedFileIds: new Set()
      });
      get().fetchFiles(null);
  },

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
      const isTrash = get().isTrashView;

      if (!companyId) return;

      set({ isLoading: true });
      try {
          let queryString = `?folderId=${folderId || 'null'}`;
          if (isTrash) queryString += `&isTrash=true`;

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
          if (!multi) current.clear();
          current.add(id);
      }
      set({ selectedFileIds: current });
  },

  selectAll: () => {
      const allIds = new Set(get().files.map(f => f.id));
      set({ selectedFileIds: allIds });
  },

  clearSelection: () => set({ selectedFileIds: new Set() }),

  uploadFile: async (file) => {
      const companyId = useAuthStore.getState().user?.company_id;
      if (!companyId) throw new Error("Empresa não identificada");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('name', file.name);
      formData.append('mimeType', file.type);
      formData.append('folderId', get().currentFolderId || 'null');

      const token = (await import('@/utils/supabase/client')).createClient().auth.getSession().then(({data}) => data.session?.access_token);
      const headers: Record<string, string> = {};
      if(token) headers['Authorization'] = `Bearer ${await token}`;

      const baseUrl = typeof window !== 'undefined' ? '/api/v1' : (BACKEND_URL || 'http://localhost:3001/api/v1');
      
      const response = await fetch(`${baseUrl}/cloud/google/upload`, {
          method: 'POST',
          headers,
          body: formData
      });

      if (!response.ok) {
          const err = await response.text();
          throw new Error(`Erro no upload: ${err}`);
      }

      get().fetchFiles();
      get().fetchQuota();
  },

  fetchQuota: async () => {
      const companyId = useAuthStore.getState().user?.company_id;
      if (!companyId) return;
      try {
          const res = await api.post('/cloud/google/quota', { companyId });
          if(res.quota) {
              set({ storageQuota: { usage: parseInt(res.quota.usage || '0'), limit: parseInt(res.quota.limit || '0') } });
          }
      } catch (e) {}
  },

  createFolder: async (name) => {
      const companyId = useAuthStore.getState().user?.company_id;
      if (!companyId) return;
      
      await api.post('/cloud/google/create-folder', {
          companyId,
          name,
          parentId: get().currentFolderId
      });
      get().fetchFiles();
  },

  deleteSelected: async () => {
      const companyId = useAuthStore.getState().user?.company_id;
      const ids = Array.from(get().selectedFileIds);
      if (!companyId || ids.length === 0) return;

      const filesToDelete = get().files.filter(f => ids.includes(f.id));
      const googleIds = filesToDelete.map(f => f.google_id);

      await api.post('/cloud/google/delete', {
          companyId,
          fileIds: googleIds
      });
      
      set({ selectedFileIds: new Set() });
      get().fetchFiles();
      get().fetchQuota();
  },

  syncNow: async () => {
      const companyId = useAuthStore.getState().user?.company_id;
      if (!companyId) return;
      await api.post('/cloud/google/sync', { companyId });
      get().fetchFiles();
      get().fetchQuota();
  },

  setViewMode: (mode) => set({ viewMode: mode })
}));
