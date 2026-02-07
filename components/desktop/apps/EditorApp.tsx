'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { api } from '@/services/api';
import { EditorToolbar, EditorTab } from './EditorToolbar';
import { cn } from '@/lib/utils';
import { Loader2, FileText } from 'lucide-react';
import './editor.css';

// Import dinâmico do Quill para evitar SSR
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export function EditorApp({ windowId }: { windowId: string }) {
  const { user } = useAuthStore();
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  const [content, setContent] = useState(initialState.content || '');
  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Documento 1'));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<EditorTab>('home');
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'page' | 'web'>('page');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load File
  useEffect(() => {
      const loadFile = async () => {
          if (!data.fileId || initialState.content) return;
          
          setIsLoadingFile(true);
          try {
              if (user?.company_id) {
                  const response = await api.post('/cloud/convert/docx', {
                      companyId: user.company_id,
                      fileId: data.fileId
                  });

                  if (response.html) {
                      setContent(response.html);
                      setFilename(response.filename || filename);
                      addToast({ type: 'success', title: 'Carregado', message: 'Documento aberto.' });
                  } else {
                      throw new Error("Conteúdo vazio.");
                  }
              }
          } catch (e: any) {
              addToast({ type: 'error', title: 'Erro', message: 'Falha ao converter documento.' });
              setContent('<p>Erro ao carregar documento.</p>');
          } finally {
              setIsLoadingFile(false);
          }
      };
      
      loadFile();
  }, [data.fileId]);

  // Auto-Save State
  useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
          setWindowState(windowId, { content, filename });
          if (content.length > 0) setWindowDirty(windowId, true);
      }, 800);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [content, filename, windowId]);

  const handleSaveDocx = async () => {
      if (!content.trim()) return;
      setIsSaving(true);
      try {
          const htmlToDocx = (await import('html-to-docx')).default;
          const blob = await htmlToDocx(content, null, {
              table: { row: { cantSplit: true } },
              footer: true,
              pageNumber: true,
              margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch TWIPS
          });
          
          let finalName = filename;
          if (!finalName.endsWith('.docx')) finalName += '.docx';

          const file = new File([blob], finalName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Salvo no Google Drive.' });
          setWindowDirty(windowId, false);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  const handlePrint = () => {
      window.print();
  };

  // Modules config for Quill referencing Custom Toolbar ID
  const modules = {
    toolbar: {
      container: "#toolbar", // ID do nosso Ribbon customizado
    },
    clipboard: { matchVisual: false }
  };

  if (isLoadingFile) {
      return <div className="flex items-center justify-center h-full bg-zinc-100 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-100 text-black overflow-hidden relative print-layout">
        
        {/* Top Bar (Title) */}
        <div className="h-8 bg-[#005a9e] text-white flex items-center justify-between px-4 shrink-0 select-none">
            <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 opacity-80" />
                <input 
                    value={filename} 
                    onChange={e => setFilename(e.target.value)} 
                    className="bg-transparent border-none outline-none text-xs font-medium placeholder-blue-200 text-white w-64 focus:bg-blue-700/50 rounded px-1"
                    placeholder="Nome do Documento"
                />
            </div>
            <span className="text-[10px] opacity-70">Wancora Docs</span>
        </div>

        {/* Ribbon Toolbar */}
        <EditorToolbar 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            zoom={zoom}
            onZoomChange={setZoom}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onPrint={handlePrint}
            onSave={handleSaveDocx}
            isSaving={isSaving}
        />

        {/* Workspace (Scrolling Area) */}
        <div className="editor-workspace flex-1 bg-zinc-200 overflow-auto relative" onClick={() => {}}>
            
            {/* Page Container */}
            <div 
                className={cn(
                    "transition-transform origin-top duration-200 ease-out",
                    viewMode === 'page' ? "page-view" : "web-view"
                )}
                style={{ transform: viewMode === 'page' ? `scale(${zoom})` : 'none' }}
            >
                <ReactQuill 
                    theme="snow" 
                    value={content} 
                    onChange={setContent} 
                    modules={modules}
                    className="h-full"
                    preserveWhitespace
                />
            </div>

        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#005a9e] text-white flex items-center justify-between px-3 text-[10px] shrink-0 select-none">
             <div className="flex gap-4">
                 <span>Página 1 de 1</span>
                 <span>{content.replace(/<[^>]*>/g, '').length} caracteres</span>
             </div>
             <div className="flex gap-4">
                 <span>{viewMode === 'page' ? 'Layout de Impressão' : 'Layout Web'}</span>
                 <span>{Math.round(zoom * 100)}%</span>
             </div>
        </div>
    </div>
  );
}