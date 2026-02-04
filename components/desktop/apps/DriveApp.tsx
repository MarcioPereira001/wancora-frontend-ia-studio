
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCloudStore, ViewMode } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { FileIcon } from '../FileIcon';
import { 
    Loader2, ArrowLeft, Cloud, UploadCloud, RefreshCw, Plus, FileText, FolderPlus, 
    Trash2, LayoutGrid, List, Grid, HardDrive, CheckSquare, X, DownloadCloud 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ImportDriveModal } from './ImportDriveModal';

export function DriveApp() {
  const { 
      currentFolderId, folderHistory, files, isLoading, selectedFileIds, storageQuota, viewMode,
      fetchFiles, fetchQuota, navigateTo, navigateUp, toggleSelection, clearSelection, 
      uploadFile, createFolder, deleteSelected, setViewMode, syncNow, selectAll
  } = useCloudStore();
  const { openWindow } = useDesktopStore();
  const { addToast } = useToast();
  
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false); // Modal de Importação

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchFiles(currentFolderId);
      fetchQuota();
  }, [currentFolderId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          addToast({ type: 'info', title: 'Enviando...', message: `Upload: ${file.name}` });
          try {
              await uploadFile(file);
              addToast({ type: 'success', title: 'Concluído', message: 'Arquivo salvo.' });
          } catch (e) {
              addToast({ type: 'error', title: 'Erro', message: 'Falha no upload.' });
          }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateFolder = async () => {
      if(!newFolderName.trim()) return;
      try {
          await createFolder(newFolderName);
          setIsCreatingFolder(false);
          setNewFolderName('');
          setTimeout(() => fetchFiles(currentFolderId), 500);
      } catch(e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao criar pasta.' });
      }
  };

  const handleDelete = async () => {
      if(!confirm(`Excluir ${selectedFileIds.size} itens permanentemente do Drive?`)) return;
      setIsDeleting(true);
      try {
          await deleteSelected();
          addToast({ type: 'success', title: 'Excluído', message: 'Itens movidos para lixeira.' });
      } catch(e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao excluir.' });
      } finally {
          setIsDeleting(false);
      }
  };

  const handleFileAction = (file: any) => {
      if (file.is_folder) {
          navigateTo(file.google_id, file.name);
      } else {
          const mime = file.mime_type || '';
          if (mime.includes('image') || mime.includes('video') || mime.includes('pdf')) {
              openWindow('preview', file.name, { url: file.web_view_link, type: mime, id: file.google_id });
          } 
          else if (mime.includes('word') || mime.includes('document')) {
               // Abre editor com ID para conversão backend
               openWindow('editor', file.name, { fileId: file.google_id, mimeType: mime });
          }
          else if (file.web_view_link) {
              window.open(file.web_view_link, '_blank');
          }
      }
  };

  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e20] text-zinc-200" onClick={() => { setShowNewMenu(false); }}>
        
        {/* Info Bar (Storage) */}
        {storageQuota && (
            <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 text-[10px] text-zinc-400 shrink-0">
                <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-zinc-500" />
                    <span>{formatBytes(storageQuota.usage)} usados de {formatBytes(storageQuota.limit)}</span>
                </div>
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${(storageQuota.usage / storageQuota.limit) * 100}%` }} />
                </div>
            </div>
        )}

        {/* Toolbar */}
        <div className="h-12 border-b border-zinc-700 bg-zinc-800/50 flex items-center px-3 gap-3 shrink-0">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={navigateUp} disabled={folderHistory.length <= 1} className="h-8 w-8 text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => fetchFiles(currentFolderId)} className="h-8 w-8 text-zinc-400 hover:text-white" title="Atualizar Pasta">
                    <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
            </div>

            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs flex items-center overflow-hidden">
                <Cloud className="w-3 h-3 text-green-500 mr-2 shrink-0" />
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap custom-scrollbar">
                    {folderHistory.map((f, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="text-zinc-600">/</span>}
                            <button onClick={(e) => { e.stopPropagation(); if(f.id !== currentFolderId) navigateTo(f.id, f.name); }} className="hover:text-white hover:underline truncate max-w-[100px]">
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-700">
                 <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded", viewMode === 'list' ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}><List className="w-3.5 h-3.5" /></button>
                 <button onClick={() => setViewMode('grid-md')} className={cn("p-1.5 rounded", viewMode === 'grid-md' ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}><LayoutGrid className="w-3.5 h-3.5" /></button>
                 <button onClick={() => setViewMode('grid-lg')} className={cn("p-1.5 rounded", viewMode === 'grid-lg' ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}><Grid className="w-3.5 h-3.5" /></button>
            </div>

            {selectedFileIds.size > 0 ? (
                <div className="flex gap-2 animate-in fade-in">
                    <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting} className="h-8 text-xs">
                         <Trash2 className="w-3 h-3 mr-1" /> Excluir ({selectedFileIds.size})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 text-xs text-zinc-400">
                         <X className="w-3 h-3" />
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                     <Button size="sm" variant="secondary" onClick={() => setShowImportModal(true)} className="h-8 text-xs bg-zinc-700 hover:bg-zinc-600 text-white gap-1 border border-zinc-600" title="Buscar arquivos no Google Drive">
                        <DownloadCloud className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Buscar Existentes</span>
                    </Button>

                    <div className="relative">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowNewMenu(!showNewMenu); }} className="h-8 bg-blue-600 hover:bg-blue-500 text-white gap-1 shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4" /> Novo
                        </Button>
                        
                        {showNewMenu && (
                            <div className="absolute right-0 top-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl w-48 py-1 z-50 animate-in zoom-in-95">
                                <button onClick={() => { setIsCreatingFolder(true); setShowNewMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 flex items-center gap-2">
                                    <FolderPlus className="w-4 h-4 text-yellow-400" /> Nova Pasta
                                </button>
                                <button onClick={() => openWindow('editor', 'Novo Documento')} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" /> Documento Texto
                                </button>
                                <div className="h-px bg-zinc-700 my-1" />
                                <label className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 flex items-center gap-2 cursor-pointer">
                                    <UploadCloud className="w-4 h-4 text-green-400" /> Upload Arquivo
                                    <input type="file" className="hidden" onChange={handleUpload} />
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {isCreatingFolder && (
            <div className="p-2 bg-zinc-800 border-b border-zinc-700 flex gap-2 animate-in slide-in-from-top-2">
                <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nome da pasta..." className="h-8 text-xs bg-zinc-900 border-zinc-600" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}/>
                <Button size="sm" onClick={handleCreateFolder} className="h-8 bg-green-600 hover:bg-green-500">Criar</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)} className="h-8">Cancelar</Button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative" onClick={() => clearSelection()}>
            {isLoading && files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-xs">Carregando...</span>
                </div>
            ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-zinc-700">
                        <FolderPlus className="w-8 h-8 opacity-20" />
                    </div>
                    <p>Pasta vazia.</p>
                </div>
            ) : (
                <>
                {viewMode === 'list' ? (
                     <div className="space-y-1">
                         <div className="flex items-center text-xs text-zinc-500 px-2 pb-2 uppercase font-bold">
                            <div className="w-8"><CheckSquare className="w-3 h-3 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); selectAll(); }} /></div>
                            <div className="flex-1">Nome</div>
                            <div className="w-24">Tamanho</div>
                            <div className="w-24">Tipo</div>
                         </div>
                         {files.map(file => (
                             <div 
                                key={file.id}
                                onClick={(e) => { e.stopPropagation(); toggleSelection(file.id, e.ctrlKey); }}
                                onDoubleClick={(e) => { e.stopPropagation(); handleFileAction(file); }}
                                className={cn("flex items-center px-2 py-2 rounded hover:bg-zinc-800 cursor-pointer text-xs group transition-colors", selectedFileIds.has(file.id) ? "bg-blue-500/20 text-blue-100" : "text-zinc-300")}
                             >
                                 <div className="w-8"><input type="checkbox" checked={selectedFileIds.has(file.id)} readOnly className="pointer-events-none" /></div>
                                 <div className="flex-1 truncate font-medium flex items-center gap-2">{file.is_folder && <FolderPlus className="w-3.5 h-3.5 text-yellow-500" />}{file.name}</div>
                                 <div className="w-24 text-zinc-500">{file.is_folder ? '-' : formatBytes(file.size || 0)}</div>
                                 <div className="w-24 text-zinc-500 truncate">{file.is_folder ? 'Pasta' : file.mime_type.split('/').pop()}</div>
                             </div>
                         ))}
                     </div>
                ) : (
                    <div className={cn("grid gap-2 content-start", viewMode === 'grid-sm' ? "grid-cols-[repeat(auto-fill,minmax(90px,1fr))]" : viewMode === 'grid-md' ? "grid-cols-[repeat(auto-fill,minmax(120px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]" )}>
                        {files.map(file => (
                            <FileIcon 
                                key={file.id} 
                                file={file}
                                selected={selectedFileIds.has(file.id)}
                                onSelect={(multi) => toggleSelection(file.id, multi)}
                                onNavigate={() => handleFileAction(file)}
                                size={viewMode === 'grid-lg' ? 'lg' : viewMode === 'grid-sm' ? 'sm' : 'md'}
                            />
                        ))}
                    </div>
                )}
                </>
            )}
        </div>
        
        <div className="h-6 bg-zinc-800 border-t border-zinc-700 flex items-center px-3 text-[10px] text-zinc-400 justify-between shrink-0">
             <span>{files.length} itens {selectedFileIds.size > 0 && `(${selectedFileIds.size} selecionados)`}</span>
             <span>Conectado ao Google Drive</span>
        </div>

        {/* Modal de Importação */}
        <ImportDriveModal 
            isOpen={showImportModal} 
            onClose={() => setShowImportModal(false)} 
            onImportSuccess={() => fetchFiles(currentFolderId)}
        />
    </div>
  );
}
