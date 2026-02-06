
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { Loader2, Search, FileText, Folder, CheckCircle, DownloadCloud } from 'lucide-react';
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
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  const handleSearch = async () => {
      if (!query.trim() || !user?.company_id) return;
      setLoading(true);
      try {
          const res = await api.post('/cloud/google/search-live', {
              companyId: user.company_id,
              query: query
          });
          setResults(res.files || []);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const toggleSelect = (file: any) => {
      setSelectedFiles(prev => {
          if (prev.find(f => f.id === file.id)) {
              return prev.filter(f => f.id !== file.id);
          }
          return [...prev, file];
      });
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
          setResults([]);
          setSelectedFiles([]);
          setQuery('');
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setImporting(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Buscar no Google Drive" maxWidth="lg">
        <div className="space-y-4 min-h-[400px] flex flex-col">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <Input 
                        value={query} 
                        onChange={e => setQuery(e.target.value)} 
                        placeholder="Digite o nome do arquivo..." 
                        className="pl-9 bg-zinc-950 border-zinc-800"
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <Button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-500">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                </Button>
            </div>

            <div className="flex-1 border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-y-auto custom-scrollbar p-2">
                {results.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <DownloadCloud className="w-12 h-12 opacity-20 mb-2" />
                        <p className="text-xs">Busque arquivos reais no seu Google Drive para importar.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {results.map(file => {
                            const isSelected = !!selectedFiles.find(f => f.id === file.id);
                            return (
                                <div 
                                    key={file.id} 
                                    onClick={() => toggleSelect(file)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded cursor-pointer transition-colors border",
                                        isSelected ? "bg-blue-500/20 border-blue-500/50" : "bg-zinc-900/50 border-transparent hover:bg-zinc-800"
                                    )}
                                >
                                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                        {isSelected ? <CheckCircle className="w-5 h-5 text-blue-400" /> : (
                                            file.mimeType.includes('folder') ? <Folder className="w-5 h-5 text-yellow-500" /> : <FileText className="w-5 h-5 text-zinc-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                        <p className="text-[10px] text-zinc-500 truncate">{file.mimeType}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
                <Button onClick={handleImport} disabled={importing || selectedFiles.length === 0} className="bg-green-600 hover:bg-green-500 text-white w-40">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Importar (${selectedFiles.length})`}
                </Button>
            </div>
        </div>
    </Modal>
  );
}
