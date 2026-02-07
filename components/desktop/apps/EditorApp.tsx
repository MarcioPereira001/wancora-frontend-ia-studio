
'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { api } from '@/services/api';
import { EditorToolbar, EditorTab } from './EditorToolbar';
import { EditorSaveModal } from './EditorSaveModal'; // Novo Modal
import { cn } from '@/lib/utils';
import { Loader2, FileText, Upload, Cloud, ChevronDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImportDriveModal } from './ImportDriveModal';
import mammoth from 'mammoth'; // Para importação de DOCX
import jsPDF from 'jspdf'; // Para exportação PDF
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

  // Modals & Menus
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isImportDriveOpen, setIsImportDriveOpen] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  // Load File (Edit Mode)
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

  // Click Outside (Menu)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
            setShowImportMenu(false);
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // --- IMPORT LOGIC ---
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoadingFile(true);
      try {
          if (file.name.endsWith('.docx')) {
              const arrayBuffer = await file.arrayBuffer();
              const result = await mammoth.convertToHtml({ arrayBuffer });
              setContent(result.value);
              addToast({ type: 'success', title: 'Importado', message: 'Documento DOCX carregado.' });
          } else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
              const text = await file.text();
              // Simples conversão de quebras de linha para HTML
              const html = text.split('\n').map(line => `<p>${line}</p>`).join('');
              setContent(html);
              addToast({ type: 'success', title: 'Importado', message: 'Texto carregado.' });
          } else if (file.type === 'application/pdf') {
              // PDF Import é complexo client-side. Mostra aviso.
               addToast({ type: 'warning', title: 'Limitação', message: 'Importação direta de PDF não suportada. Converta para DOCX primeiro.' });
          }
          
          // Atualiza nome se for um arquivo novo
          if (!data.fileId) {
             setFilename(file.name.replace(/\.[^/.]+$/, ""));
          }
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha na importação: ' + e.message });
      } finally {
          setIsLoadingFile(false);
          setShowImportMenu(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  // --- SAVE LOGIC ---
  const handleConfirmSave = async (target: 'drive' | 'local', format: 'docx' | 'pdf', newName: string) => {
      if (!content.trim()) {
           addToast({ type: 'warning', title: 'Vazio', message: 'O documento está vazio.' });
           return;
      }

      setFilename(newName);
      setIsSaveModalOpen(false);
      setIsSaving(true);

      try {
          // Geração do Blob
          let blob: Blob | null = null;
          let mimeType = '';
          let extension = '';

          if (format === 'docx') {
              const htmlToDocx = (await import('html-to-docx')).default;
              blob = await htmlToDocx(content, null, {
                  table: { row: { cantSplit: true } },
                  footer: true,
                  pageNumber: true,
                  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
              });
              mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              extension = '.docx';
          } else if (format === 'pdf') {
              // PDF Client Side (Simplificado)
              const doc = new jsPDF();
              // Usando o método .html do jsPDF que renderiza o HTML (pode ser lento para docs grandes)
              // Tentativa de HTML render (Requer container temporário)
              const element = document.createElement('div');
              element.innerHTML = content;
              element.style.width = '190mm';
              element.style.padding = '10mm';
              element.style.visibility = 'hidden';
              document.body.appendChild(element);
              
              await doc.html(element, {
                  callback: (d) => { blob = d.output('blob'); },
                  x: 10, y: 10, width: 190, windowWidth: 800
              });
              document.body.removeChild(element);
              
              // Se o callback for assíncrono, o blob pode ser null aqui se não esperarmos. 
              if (!blob) blob = doc.output('blob');
              
              mimeType = 'application/pdf';
              extension = '.pdf';
          }

          if (!blob) throw new Error("Falha ao gerar arquivo.");

          // Nome Final
          let finalName = newName;
          if (!finalName.endsWith(extension)) finalName += extension;

          // Ação: Download ou Upload
          if (target === 'local') {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = finalName;
              a.click();
              URL.revokeObjectURL(url);
          } else {
              // Se estamos editando um arquivo existente e o nome é o mesmo, o backend do upload 
              // pode criar duplicata se não tiver lógica de update. 
              // Para substituir, o usuário deve selecionar a mesma pasta/nome.
              
              const file = new File([blob], finalName, { type: mimeType });
              await uploadFile(file);
              setWindowDirty(windowId, false);
              addToast({ type: 'success', title: 'Salvo', message: 'Salvo no Google Drive.' });
          }

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
        <input type="file" ref={fileInputRef} className="hidden" accept=".docx,.txt,.md,.pdf" onChange={handleImportFile} />

        {/* Top Bar (Title) */}
        <div className="h-10 bg-white border-b border-zinc-300 flex items-center justify-between px-3 shrink-0 select-none">
            <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-600 rounded text-white"><FileText className="w-4 h-4" /></div>
                <Input 
                    value={filename} 
                    onChange={e => setFilename(e.target.value)} 
                    className="h-7 w-64 border-transparent hover:border-zinc-300 font-bold text-black bg-transparent px-2 focus:border-blue-600 focus:bg-white" 
                    placeholder="Nome do Documento"
                />
            </div>

            {/* Actions: Import & Save */}
            <div className="flex gap-2">
                 {/* Menu Importar */}
                 <div className="relative" ref={importMenuRef}>
                    <Button 
                        size="sm" 
                        variant="ghost"
                        className={cn("h-7 gap-1 font-bold text-zinc-600 bg-zinc-100 border border-zinc-200", showImportMenu ? "bg-zinc-200" : "")}
                        onClick={() => setShowImportMenu(!showImportMenu)}
                    >
                        <Upload className="w-3.5 h-3.5 text-orange-500" /> Importar <ChevronDown className="w-3 h-3" />
                    </Button>
                    {showImportMenu && (
                        <div className="absolute top-8 right-0 bg-white border border-zinc-200 shadow-xl rounded-lg w-48 py-1 z-50 animate-in fade-in zoom-in-95">
                            <button onClick={() => { setIsImportDriveOpen(true); setShowImportMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2">
                                <Cloud className="w-4 h-4 text-blue-500" /> Do Google Drive
                            </button>
                            <label className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2 cursor-pointer">
                                <Upload className="w-4 h-4 text-zinc-500" /> Do Computador
                                <input type="file" className="hidden" accept=".docx,.txt,.md" onChange={(e) => { handleImportFile(e); setShowImportMenu(false); }} />
                            </label>
                        </div>
                    )}
                 </div>

                 <Button 
                    size="sm" 
                    onClick={() => setIsSaveModalOpen(true)} 
                    className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-7 text-xs font-bold shadow-sm"
                 >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
                 </Button>
             </div>
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
            onSave={() => setIsSaveModalOpen(true)}
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
        <div className="h-6 bg-zinc-100 border-t border-zinc-300 flex items-center justify-between px-3 text-[10px] text-zinc-500 shrink-0 select-none">
             <div className="flex gap-4">
                 <span>Página 1 de 1</span>
                 <span>{content.replace(/<[^>]*>/g, '').length} caracteres</span>
             </div>
             <div className="flex gap-4">
                 <span>{viewMode === 'page' ? 'Layout de Impressão' : 'Layout Web'}</span>
                 <span>{Math.round(zoom * 100)}%</span>
             </div>
        </div>

        {/* Modals */}
        <EditorSaveModal 
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            currentFilename={filename}
            onConfirm={handleConfirmSave}
            isSaving={isSaving}
        />

        <ImportDriveModal 
            isOpen={isImportDriveOpen}
            onClose={() => setIsImportDriveOpen(false)}
            onImportSuccess={() => { /* Refresh se necessário */ }}
        />
    </div>
  );
}
