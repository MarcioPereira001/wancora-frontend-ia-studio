
import { create } from 'zustand';
import { DriveFile } from '@/types';
import { api } from '@/services/api'; // Este wrapper usa fetch, precisamos bypassar para FormData
import { useAuthStore } from './useAuthStore';
import { BACKEND_URL } from '../config';

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
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('name', file.name);
      formData.append('mimeType', file.type);
      // FormData transforma null em "null" string, tratamos isso no backend
      formData.append('folderId', get().currentFolderId || 'null');

      // Fazendo fetch direto para suportar FormData (o api wrapper do projeto força Content-Type: json)
      const token = (await import('@/utils/supabase/client')).createClient().auth.getSession().then(({data}) => data.session?.access_token);
      
      const headers: Record<string, string> = {};
      if(token) headers['Authorization'] = `Bearer ${await token}`;

      const baseUrl = typeof window !== 'undefined' ? '/api/v1' : (BACKEND_URL || 'http://localhost:3001/api/v1');
      
      const response = await fetch(`${baseUrl}/cloud/google/upload`, {
          method: 'POST',
          headers, // Não seta Content-Type, o browser faz isso para multipart com boundary
          body: formData
      });

      if (!response.ok) {
          const err = await response.text();
          throw new Error(`Erro no upload: ${err}`);
      }

      // Refresh após upload
      get().fetchFiles();
  }
}));
