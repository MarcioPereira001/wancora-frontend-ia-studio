
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { FileIcon } from '../FileIcon';
import { Loader2, ArrowLeft, Cloud, UploadCloud, RefreshCw, Plus, FileText, FolderPlus, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

export function DriveApp() {
  const { 
      currentFolderId, folderHistory, files, isLoading, selectedFileIds,
      fetchFiles, navigateTo, navigateUp, toggleSelection, clearSelection, uploadFile 
  } = useCloudStore();
  const { openWindow } = useDesktopStore();
  const { addToast } = useToast();
  
  const [showNewMenu, setShowNewMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchFiles(currentFolderId);
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

  const handleFileAction = (file: any) => {
      if (file.is_folder) {
          navigateTo(file.google_id, file.name);
      } else {
          // Abre Preview (Se for imagem) ou Link Externo
          if (file.mime_type.includes('image') && file.web_view_link) {
              openWindow('preview', file.name, { url: file.web_view_link, type: 'image' });
          } else if (file.web_view_link) {
              window.open(file.web_view_link, '_blank');
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e20] text-zinc-200" onClick={() => { clearSelection(); setShowNewMenu(false); }}>
        {/* Toolbar */}
        <div className="h-12 border-b border-zinc-700 bg-zinc-800/50 flex items-center px-3 gap-3 shrink-0">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={navigateUp} disabled={folderHistory.length <= 1} className="h-8 w-8 text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => fetchFiles(currentFolderId)} className="h-8 w-8 text-zinc-400 hover:text-white">
                    <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
            </div>

            {/* Breadcrumb Path */}
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs flex items-center overflow-hidden">
                <Cloud className="w-3 h-3 text-green-500 mr-2 shrink-0" />
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap custom-scrollbar">
                    {folderHistory.map((f, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="text-zinc-600">/</span>}
                            <button 
                                onClick={(e) => { e.stopPropagation(); if(f.id !== currentFolderId) navigateTo(f.id, f.name); }}
                                className="hover:text-white hover:underline"
                            >
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            {/* New Button */}
            <div className="relative">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowNewMenu(!showNewMenu); }} className="h-8 bg-blue-600 hover:bg-blue-500 text-white gap-1">
                    <Plus className="w-4 h-4" /> Novo
                </Button>
                
                {showNewMenu && (
                    <div className="absolute right-0 top-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl w-48 py-1 z-50 animate-in zoom-in-95">
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

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {isLoading && files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-xs">Carregando...</span>
                </div>
            ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <FolderPlus className="w-8 h-8 opacity-20" />
                    </div>
                    <p>Pasta vazia.</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 content-start">
                    {files.map(file => (
                        <FileIcon 
                            key={file.id} 
                            file={file}
                            selected={selectedFileIds.has(file.id)}
                            onSelect={(multi) => toggleSelection(file.id, multi)}
                            onNavigate={() => handleFileAction(file)}
                        />
                    ))}
                </div>
            )}
        </div>

        {/* Footer Info */}
        <div className="h-6 bg-zinc-800 border-t border-zinc-700 flex items-center px-3 text-[10px] text-zinc-400 justify-between shrink-0">
             <span>{files.length} itens</span>
             <span>Conectado ao Google Drive</span>
        </div>
    </div>
  );
}
