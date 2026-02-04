'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { jsPDF } from 'jspdf';
import './editor.css';
import { api } from '@/services/api';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export function EditorApp({ windowId }: { windowId: string }) {
  const { user } = useAuthStore();
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  // Recupera estado inicial e dados passados na abertura da janela
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  const [content, setContent] = useState(initialState.content || '');
  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Novo Documento'));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega arquivo existente (Se data.fileId estiver presente)
  useEffect(() => {
      const loadFile = async () => {
          if (!data.fileId || initialState.content) return; // Se já tem content carregado, ignora
          
          setIsLoadingFile(true);
          try {
              // Importa mammoth dinamicamente para não pesar o bundle
              const mammoth = (await import('mammoth')).default;

              // Como o conteúdo binário fica no backend e não temos rota direta GET binária pública com auth do Google
              // Vamos simular a edição apenas se o usuário tiver criado agora, ou avisar.
              
              // Mas, como prometido na análise, vamos tentar usar a rota send-to-whatsapp logic mas adaptada
              // Na prática, em produção, precisaríamos de uma rota `GET /cloud/download/:fileId`
              
              addToast({ type: 'info', title: 'Edição', message: 'Iniciando documento em branco. Importação de DOCX legado requer rota de download binário.' });
              
          } catch (e) {
              console.error(e);
              addToast({ type: 'error', title: 'Erro', message: 'Não foi possível carregar o conteúdo original.' });
          } finally {
              setIsLoadingFile(false);
          }
      };
      
      loadFile();
  }, [data.fileId]);

  // Atualiza store global (Persistência & Dirty State)
  useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      debounceRef.current = setTimeout(() => {
          const isDirty = content !== (initialState.content || '');
          setWindowState(windowId, { content, filename });
          if (content.length > 0) setWindowDirty(windowId, true);
      }, 500);

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
          });
          
          // Adiciona .docx se não tiver
          let finalName = filename;
          if (!finalName.endsWith('.docx')) finalName += '.docx';

          const file = new File([blob], finalName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Documento salvo no Drive.' });
          setWindowDirty(windowId, false);
          setWindowState(windowId, { content, filename }); 

      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  const handleExportPDF = () => {
      const doc = new jsPDF();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const text = tempDiv.innerText || '';
      
      const splitText = doc.splitTextToSize(text, 180);
      doc.text(splitText, 10, 10);
      doc.save(`${filename}.pdf`);
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  };

  if (isLoadingFile) {
      return <div className="flex items-center justify-center h-full text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-white text-black">
        {/* Toolbar Superior */}
        <div className="h-14 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <Input 
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="h-8 bg-transparent border-transparent hover:border-zinc-300 focus:border-blue-500 font-bold text-zinc-800 w-48"
                />
            </div>
            <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportPDF} className="h-8 text-xs border-zinc-300 text-zinc-700">
                    <Download className="w-3 h-3 mr-2" /> PDF
                </Button>
                <Button size="sm" onClick={handleSaveDocx} disabled={isSaving} className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="w-3 h-3 mr-2" /> {isSaving ? 'Salvando...' : 'Salvar no Drive'}
                </Button>
            </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
            <ReactQuill 
                theme="snow" 
                value={content} 
                onChange={setContent} 
                modules={modules}
                className="h-full flex flex-col"
            />
        </div>
    </div>
  );
}