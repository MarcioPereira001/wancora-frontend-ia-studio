
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { Loader2, Search, FileText, Folder, CheckCircle, DownloadCloud, ChevronRight, CornerUpLeft, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function ImportDriveModal({ isOpen, onClose, onImportSuccess }: ImportDriveModalProps) {
  const { user } = useAuthStore();
  const { currentFolderId } = useCloudStore(); 
  const { addToast } = useToast();
  
  // State for Browsing
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [currentRemoteFolder, setCurrentRemoteFolder] = useState<string>('root');
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([{id: 'root', name: 'Meu Drive'}]);
  
  // State for Search
  const [query, setQuery] = useState('');
  
  // Common State
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  // Load content when opening or navigating
  useEffect(() => {
      if (isOpen && mode === 'browse') {
          fetchFolderContent(currentRemoteFolder);
      }
  }, [isOpen, mode, currentRemoteFolder]);

  const fetchFolderContent = async (folderId: string) => {
      if (!user?.company_id) return;
      setLoading(true);
      try {
          const res = await api.post('/cloud/google/list-remote', {
              companyId: user.company_id,
              folderId: folderId === 'root' ? null : folderId
          });
          setItems(res.files || []);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const handleSearch = async () => {
      if (!query.trim() || !user?.company_id) return;
      setLoading(true);
      try {
          const res = await api.post('/cloud/google/search-live', {
              companyId: user.company_id,
              query: query
          });
          setItems(res.files || []);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const navigateTo = (folderId: string, folderName: string) => {
      setCurrentRemoteFolder(folderId);
      setFolderHistory([...folderHistory, { id: folderId, name: folderName }]);
      setSelectedFiles([]); // Limpa seleção ao mudar de pasta
  };

  const navigateUp = () => {
      if (folderHistory.length <= 1) return;
      const newHistory = folderHistory.slice(0, -1);
      const parent = newHistory[newHistory.length - 1];
      setFolderHistory(newHistory);
      setCurrentRemoteFolder(parent.id);
      setSelectedFiles([]);
  };

  const toggleSelect = (file: any) => {
      setSelectedFiles(prev => {
          if (prev.find(f => f.id === file.id)) {
              return prev.filter(f => f.id !== file.id);
          }
          return [...prev, file];
      });
  };

  const handleItemClick = (item: any) => {
      if (item.is_folder && mode === 'browse') {
          navigateTo(item.id, item.name);
      } else {
          toggleSelect(item);
      }
  };

  const handleImport = async () => {
      if (selectedFiles.length === 0 || !user?.company_id) return;
      
      setImporting(true);
      try {
          const res = await api.post('/cloud/google/import', {
              companyId: user.company_id,
              files: selectedFiles,
              currentFolderId: currentFolderId || 'null' 
          });
          addToast({ type: 'success', title: 'Importado', message: `${res.count} arquivos adicionados nesta pasta.` });
          onImportSuccess();
          onClose();
          // Reset states
          setItems([]);
          setSelectedFiles([]);
          setQuery('');
          setFolderHistory([{id: 'root', name: 'Meu Drive'}]);
          setCurrentRemoteFolder('root');
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setImporting(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar do Google Drive" maxWidth="lg">
        <div className="flex flex-col h-[500px]">
            
            {/* Header / Mode Switcher */}
            <div className="flex gap-2 mb-4 bg-zinc-900 p-1 rounded-lg border border-zinc-800 shrink-0">
                 <button 
                    onClick={() => { setMode('browse'); setQuery(''); }} 
                    className={cn("flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors", mode === 'browse' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}
                 >
                     <HardDrive className="w-3.5 h-3.5" /> Navegar Pastas
                 </button>
                 <button 
                    onClick={() => { setMode('search'); setItems([]); }} 
                    className={cn("flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors", mode === 'search' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}
                 >
                     <Search className="w-3.5 h-3.5" /> Buscar Arquivo
                 </button>
            </div>

            {/* Navigation / Search Bar */}
            <div className="flex gap-2 mb-2 shrink-0">
                {mode === 'browse' ? (
                     <div className="flex-1 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-3 h-10 overflow-hidden text-sm">
                         {folderHistory.length > 1 && (
                             <button onClick={navigateUp} className="mr-2 hover:bg-zinc-800 p-1 rounded">
                                 <CornerUpLeft className="w-4 h-4 text-zinc-400" />
                             </button>
                         )}
                         <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap custom-scrollbar">
                             {folderHistory.map((f, i) => (
                                 <React.Fragment key={f.id}>
                                     {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
                                     <span className={cn("truncate max-w-[100px]", i === folderHistory.length - 1 ? "text-white font-bold" : "text-zinc-500")}>
                                         {f.name}
                                     </span>
                                 </React.Fragment>
                             ))}
                         </div>
                     </div>
                ) : (
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                        <Input 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            placeholder="Nome do arquivo..." 
                            className="pl-9 bg-zinc-950 border-zinc-800 h-10"
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            autoFocus
                        />
                    </div>
                )}
                {mode === 'search' && (
                    <Button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-500">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                    </Button>
                )}
            </div>

            {/* File List */}
            <div className="flex-1 border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-y-auto custom-scrollbar p-2 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <DownloadCloud className="w-12 h-12 opacity-20 mb-2" />
                        <p className="text-xs">Nenhum item encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {items.map(file => {
                            const isSelected = !!selectedFiles.find(f => f.id === file.id);
                            return (
                                <div 
                                    key={file.id} 
                                    onClick={() => handleItemClick(file)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded cursor-pointer transition-colors border select-none group",
                                        isSelected 
                                            ? "bg-blue-500/20 border-blue-500/50" 
                                            : "bg-zinc-900/50 border-transparent hover:bg-zinc-800"
                                    )}
                                >
                                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                        {isSelected ? <CheckCircle className="w-5 h-5 text-blue-400" /> : (
                                            file.is_folder || file.mimeType?.includes('folder') 
                                                ? <Folder className="w-5 h-5 text-yellow-500 fill-yellow-500/10" /> 
                                                : <FileText className="w-5 h-5 text-zinc-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-sm truncate", isSelected ? "text-blue-100 font-medium" : "text-white")}>{file.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                            <span>{file.is_folder ? 'Pasta' : (parseInt(file.size)/1024).toFixed(0) + ' KB'}</span>
                                            {file.is_folder && <span className="text-zinc-600 bg-zinc-900 px-1 rounded group-hover:text-zinc-400">Clique para abrir</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-zinc-800 shrink-0">
                <span className="text-xs text-zinc-500">
                    {selectedFiles.length} item(s) selecionado(s)
                </span>
                <Button onClick={handleImport} disabled={importing || selectedFiles.length === 0} className="bg-green-600 hover:bg-green-500 text-white w-40">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Importar`}
                </Button>
            </div>
        </div>
    </Modal>
  );
}
