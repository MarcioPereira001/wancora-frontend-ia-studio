
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, FileText, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useAuthStore } from '@/store/useAuthStore';
// REMOVIDO: import htmlToDocx from 'html-to-docx'; (Causa erro de fs no build)
import { jsPDF } from 'jspdf';

// Carrega react-quill-new dinamicamente
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
// FIXED: Importação CSS via CDN no layout.tsx para evitar erro de build "Module not found"
// import 'react-quill-new/dist/quill.snow.css';

// Estilos customizados
import './editor.css';

export function EditorApp({ windowId }: { windowId: string }) {
  const { user } = useAuthStore();
  const { uploadFile, currentFolderId } = useCloudStore();
  const { addToast } = useToast();

  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('Novo Documento');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDocx = async () => {
      if (!content.trim()) return;
      setIsSaving(true);
      try {
          // IMPORTAÇÃO DINÂMICA: O Pulo do Gato 🐱
          // Isso garante que o 'fs' só seja exigido sob demanda, permitindo que o Webpack ignore-o no bundle principal
          const htmlToDocx = (await import('html-to-docx')).default;

          const blob = await htmlToDocx(content, null, {
              table: { row: { cantSplit: true } },
              footer: true,
              pageNumber: true,
          });
          
          const file = new File([blob], `${filename}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Documento salvo no Drive.' });
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
                <span className="text-xs text-zinc-400">.docx</span>
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
