
'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Upload, Trash2, Loader2, FileText, Folder, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/components/ui/tag-input';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { useToast } from '@/hooks/useToast';
import { AgentLevel } from '@/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface NodeInspectorProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
  agentLevel: AgentLevel;
  companyId: string;
}

const ROLES = [
  "Vendedor Consultivo", "Closer (Fechamento)", "Suporte Técnico N2", "Gerente de Contas", "Secretária Executiva"
];

export function NodeInspector({ node, onClose, onUpdate, agentLevel, companyId }: NodeInspectorProps) {
  const { addToast } = useToast();
  const [data, setData] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  
  // Drive State
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [syncingFolder, setSyncingFolder] = useState(false);

  useEffect(() => {
    if (node) setData(node.data || {});
  }, [node]);

  // Carrega pastas do Drive se for ferramenta de arquivos
  useEffect(() => {
      if (node?.type === 'tool' && data.toolType === 'files') {
          fetchFolders();
      }
  }, [node?.type, data.toolType]);

  const fetchFolders = async () => {
      setLoadingFolders(true);
      try {
          // Lista remota filtrada para pastas
          const res = await api.post('/cloud/google/list-remote', { companyId });
          if (res.files) {
              const folders = res.files.filter((f: any) => f.is_folder || f.mimeType === 'application/vnd.google-apps.folder');
              setDriveFolders(folders);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingFolders(false);
      }
  };

  if (!node) return null;

  const handleChange = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(node.id, newData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const currentFiles = data.files || [];
      const textLimit = agentLevel === 'senior' ? 6 : 4;
      const mediaLimit = agentLevel === 'senior' ? 20 : 10;
      
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('audio/');
      
      if (!isMedia && currentFiles.filter((f: any) => f.type === 'text').length >= textLimit) {
          return addToast({ type: 'error', title: 'Limite Atingido', message: `Máximo de ${textLimit} arquivos de texto.` });
      }
      if (isMedia && currentFiles.filter((f: any) => f.type !== 'text').length >= mediaLimit) {
          return addToast({ type: 'error', title: 'Limite Atingido', message: `Máximo de ${mediaLimit} arquivos de mídia.` });
      }

      setUploading(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, companyId);
          const newFile = { 
              name: file.name, 
              url: publicUrl, 
              type: isMedia ? (file.type.startsWith('image/') ? 'image' : 'audio') : 'text' 
          };
          handleChange('files', [...currentFiles, newFile]);
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha no upload.' });
      } finally {
          setUploading(false);
          e.target.value = '';
      }
  };

  const handleSyncFolder = async () => {
      if (!data.drive_folder_id) return;
      setSyncingFolder(true);
      try {
          // Importa a pasta selecionada para o cache do sistema para que a IA possa buscar nela
          await api.post('/cloud/google/import', {
              companyId,
              files: [{ id: data.drive_folder_id, name: 'Agent Folder', mimeType: 'application/vnd.google-apps.folder' }],
              currentFolderId: null
          });
          addToast({ type: 'success', title: 'Sincronizado', message: 'Pasta indexada para o agente.' });
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao sincronizar pasta.' });
      } finally {
          setSyncingFolder(false);
      }
  };

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 h-full flex flex-col animate-in slide-in-from-right-10 shadow-2xl">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
            <span className="font-bold text-sm text-zinc-100 uppercase tracking-wider">{node.type}</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            
            {/* PERSONALITY CONFIG */}
            {node.type === 'personality' && (
                <>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Cargo / Papel</label>
                        <select 
                            value={data.role || ''} 
                            onChange={(e) => handleChange('role', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white"
                        >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tom de Voz</label>
                        <Input value={data.tone || ''} onChange={e => handleChange('tone', e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Persuasivo e confiante" />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Contexto</label>
                         <Textarea 
                            value={data.context || ''} 
                            onChange={e => handleChange('context', e.target.value)} 
                            className="bg-zinc-950 border-zinc-800 min-h-[100px]" 
                            placeholder="Descreva a empresa..."
                         />
                    </div>
                </>
            )}

            {/* KNOWLEDGE CONFIG */}
            {node.type === 'knowledge' && (
                <>
                    <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg mb-4">
                        <p className="text-xs text-orange-200">
                            Capacidade do Agente {agentLevel === 'senior' ? 'Sênior' : 'Pleno'}:<br/>
                            - Textos: {agentLevel === 'senior' ? 6 : 4}<br/>
                            - Mídias: {agentLevel === 'senior' ? 20 : 10}
                        </p>
                    </div>
                    <div>
                        <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors mb-4">
                            <div className="flex flex-col items-center gap-1 text-zinc-500">
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                <span className="text-xs font-medium">Upload Arquivo</span>
                            </div>
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                        </label>
                        <div className="space-y-2">
                            {(data.files || []).map((file: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded group">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                                        <span className="text-xs text-zinc-200 truncate">{file.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleChange('files', data.files.filter((_: any, i: number) => i !== idx))}
                                        className="text-zinc-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* SPECIALIST CONFIG */}
            {node.type === 'specialist' && (
                <>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Técnica de Vendas</label>
                        <select 
                            value={data.technique || ''} 
                            onChange={(e) => handleChange('technique', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white"
                        >
                            <option value="spin">SPIN Selling</option>
                            <option value="bunt">BANT (Budget, Authority...)</option>
                            <option value="challenger">Challenger Sale</option>
                            <option value="sandler">Sandler Selling</option>
                        </select>
                    </div>
                    <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Instrução Específica</label>
                         <Textarea 
                            value={data.instruction || ''} 
                            onChange={e => handleChange('instruction', e.target.value)} 
                            className="bg-zinc-950 border-zinc-800 min-h-[150px]" 
                            placeholder="Como o especialista deve agir..."
                         />
                    </div>
                </>
            )}

            {/* TOOL CONFIG (SENIOR ONLY) */}
            {node.type === 'tool' && (
                <>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tipo de Integração</label>
                        <select 
                            value={data.toolType || 'files'} 
                            onChange={(e) => handleChange('toolType', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white"
                        >
                            <option value="files">Google Drive (Arquivos)</option>
                            <option value="calendar">Agendamento (Calendar)</option>
                            <option value="crm">Consulta CRM</option>
                        </select>
                    </div>
                    
                    {data.toolType === 'files' && (
                        <div className="mt-4 space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200">
                                <p className="mb-2"><strong>Integração Drive:</strong></p>
                                Selecione uma pasta do Google Drive. O agente poderá buscar e enviar arquivos dessa pasta durante a conversa.
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Pasta Alvo</label>
                                {loadingFolders ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando pastas...</div>
                                ) : (
                                    <div className="space-y-2">
                                        <select 
                                            value={data.drive_folder_id || ''} 
                                            onChange={(e) => handleChange('drive_folder_id', e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white"
                                        >
                                            <option value="">Selecione uma pasta...</option>
                                            {driveFolders.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>

                                        {data.drive_folder_id && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={handleSyncFolder} 
                                                disabled={syncingFolder}
                                                className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs"
                                            >
                                                {syncingFolder ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                                Sincronizar Índice Agora
                                            </Button>
                                        )}
                                        <p className="text-[10px] text-zinc-500">* Clique em sincronizar para garantir que a IA conheça os arquivos atuais.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* GUARD CONFIG */}
            {node.type === 'guard' && (
                <>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Prompts Negativos (O que não falar)</label>
                        <TagInput tags={data.negative_prompts || []} onChange={(tags) => handleChange('negative_prompts', tags)} />
                    </div>
                    <div className="mt-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Regras de Escape (Quando chamar humano)</label>
                        <TagInput tags={data.escape_rules || []} onChange={(tags) => handleChange('escape_rules', tags)} />
                    </div>
                </>
            )}
            
        </div>
        
        <div className="p-4 border-t border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-600">ID: {node.id}</span>
        </div>
    </div>
  );
}
