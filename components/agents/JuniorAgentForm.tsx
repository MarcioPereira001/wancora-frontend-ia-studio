
'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLevel } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Save, Briefcase, Mic2, AlertOctagon, ShieldCheck, FileText, Upload, Trash2, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { uploadChatMedia } from '@/utils/supabase/storage';

interface JuniorAgentFormProps {
  initialData?: Agent | null;
  companyId: string;
  onSuccess: () => void;
}

const ROLES = [
  "Atendente de Nível 1",
  "Recepcionista Virtual",
  "Suporte Técnico Básico",
  "SDR (Pré-vendas)",
  "Agendador de Reuniões",
  "Tira-Dúvidas (FAQ)",
  "Gerente de Comunidade"
];

const TONES = [
  { id: 'empatico', label: 'Empático & Acolhedor', desc: 'Foca em entender e acalmar o cliente.' },
  { id: 'profissional', label: 'Formal & Corporativo', desc: 'Direto, sério e extremamente polido.' },
  { id: 'entusiasta', label: 'Energético & Vendedor', desc: 'Usa emojis, exclamações e persuasão.' },
  { id: 'tecnico', label: 'Técnico & Preciso', desc: 'Baseado em fatos, sem rodeios.' },
  { id: 'descontraido', label: 'Casual & Amigável', desc: 'Como um amigo no WhatsApp. Gírias leves.' },
  { id: 'minimalista', label: 'Minimalista (Conciso)', desc: 'Respostas de no máximo 2 frases.' },
];

export function JuniorAgentForm({ initialData, companyId, onSuccess }: JuniorAgentFormProps) {
  const { addToast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Estados do Formulário
  const [name, setName] = useState(initialData?.name || 'Agente Junior');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  
  // Personality Config
  const [role, setRole] = useState(initialData?.personality_config?.role || ROLES[0]);
  const [tone, setTone] = useState(initialData?.personality_config?.tone || 'profissional');
  const [context, setContext] = useState((initialData as any)?.personality_config?.context || ''); // Campo custom para UI
  const [negativePrompts, setNegativePrompts] = useState<string[]>(initialData?.personality_config?.negative_prompts || []);
  const [goldenRules, setGoldenRules] = useState<string[]>(initialData?.personality_config?.escape_rules || []); // Usando escape_rules como golden rules genericas
  
  // Core Prompt
  const [systemPrompt, setSystemPrompt] = useState(initialData?.prompt_instruction || '');

  // Files
  const [files, setFiles] = useState<{name: string, url: string, type: string}[]>(
      (initialData?.knowledge_config?.text_files as any) || []
  );
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (files.length >= 2) {
          addToast({ type: 'warning', title: 'Limite Atingido', message: 'O Agente Junior suporta no máximo 2 arquivos.' });
          return;
      }

      if (file.size > 2 * 1024 * 1024) { // 2MB
          addToast({ type: 'error', title: 'Muito Grande', message: 'Máximo 2MB por arquivo para Junior.' });
          return;
      }

      setUploadingFile(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, companyId);
          setFiles(prev => [...prev, { name: file.name, url: publicUrl, type: 'text' }]);
          addToast({ type: 'success', title: 'Upload Concluído', message: 'Arquivo adicionado à base de conhecimento.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setUploadingFile(false);
          e.target.value = '';
      }
  };

  const handleSave = async () => {
      if (!name.trim() || !systemPrompt.trim()) {
          addToast({ type: 'warning', title: 'Campos Obrigatórios', message: 'Nome e Prompt do Sistema são essenciais.' });
          return;
      }

      setLoading(true);
      try {
          // Compilação do JSONB
          const personalityConfig = {
              role,
              tone,
              context, // Salvamos o contexto isolado para re-edição fácil
              negative_prompts: negativePrompts,
              escape_rules: goldenRules // Mapeando Regras de Ouro para escape_rules
          };

          const knowledgeConfig = {
              text_files: files.map(f => ({ 
                  id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                  name: f.name, 
                  type: 'text' as const, 
                  url: f.url 
              })),
              media_files: [] // Junior não suporta mídia na KB
          };

          const payload = {
              company_id: companyId,
              name,
              level: 'junior' as AgentLevel,
              prompt_instruction: systemPrompt,
              personality_config: personalityConfig,
              knowledge_config: knowledgeConfig,
              is_active: isActive,
              model: 'gemini-3-flash-preview', // Modelo padrão para Junior
              transcription_enabled: true
          };

          if (initialData?.id) {
              const { error } = await supabase.from('agents').update(payload).eq('id', initialData.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('agents').insert(payload);
              if (error) throw error;
          }

          addToast({ type: 'success', title: 'Agente Salvo', message: 'Seu Agente Junior está pronto.' });
          onSuccess();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao Salvar', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Bot className="w-8 h-8 text-blue-400" />
                    Configurar Agente Junior
                </h2>
                <p className="text-zinc-400 text-sm mt-1">Ideal para triagem, FAQ e atendimento inicial.</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                    <span className="text-xs font-bold text-zinc-400 uppercase">Status</span>
                    <div 
                        onClick={() => setIsActive(!isActive)}
                        className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", isActive ? "bg-green-600" : "bg-zinc-700")}
                    >
                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", isActive ? "left-6" : "left-1")} />
                    </div>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Agente
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUNA 1: IDENTIDADE & PERFIL */}
            <div className="space-y-6">
                <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-500" /> Identidade</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Agente</label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Ana do Suporte" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Função / Cargo</label>
                            <select 
                                value={role} 
                                onChange={e => setRole(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Contexto Geral</label>
                            <Textarea 
                                value={context} 
                                onChange={e => setContext(e.target.value)} 
                                className="bg-zinc-950 border-zinc-800 min-h-[100px]" 
                                placeholder="Descreva a empresa, o que ela vende e quem é o cliente ideal..." 
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Mic2 className="w-4 h-4 text-purple-500" /> Tom de Voz</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                            {TONES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTone(t.id)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                                        tone === t.id 
                                            ? "bg-purple-500/10 border-purple-500/50" 
                                            : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700"
                                    )}
                                >
                                    <span className={cn("text-xs font-bold", tone === t.id ? "text-purple-400" : "text-zinc-300")}>{t.label}</span>
                                    <span className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COLUNA 2: CÉREBRO (PROMPTS) */}
            <div className="space-y-6">
                <Card className="bg-zinc-900/40 border-zinc-800 h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-green-500" /> Cérebro & Comportamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">System Prompt (Instrução Mestra)</label>
                                <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">Obrigatório</span>
                            </div>
                            <Textarea 
                                value={systemPrompt} 
                                onChange={e => setSystemPrompt(e.target.value)} 
                                className="bg-zinc-950 border-zinc-800 min-h-[200px] font-mono text-xs leading-relaxed" 
                                placeholder="Você é um assistente útil. Seu objetivo é qualificar leads..." 
                            />
                            <p className="text-[10px] text-zinc-500 mt-2 flex gap-1">
                                <Info className="w-3 h-3" />
                                Descreva passo a passo como o agente deve raciocinar.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                <AlertOctagon className="w-3 h-3 text-red-500" /> O que NÃO fazer (Prompts Negativos)
                            </label>
                            <TagInput 
                                tags={negativePrompts} 
                                onChange={setNegativePrompts} 
                                placeholder="Ex: Não use gírias, Não invente preços..." 
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3 text-yellow-500" /> Regras de Ouro (Diretrizes Fixas)
                            </label>
                            <TagInput 
                                tags={goldenRules} 
                                onChange={setGoldenRules} 
                                placeholder="Ex: Sempre pergunte o nome, Transfira se não souber..." 
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COLUNA 3: CONHECIMENTO */}
            <div className="space-y-6">
                <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-orange-500" /> Base de Conhecimento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-lg">
                            <p className="text-xs text-orange-200/80 leading-relaxed mb-3">
                                O Agente Junior pode ler até <strong>2 arquivos de texto</strong> para usar como base de resposta. Ideal para FAQs, Tabelas de Preço simples ou Scripts.
                            </p>
                            
                            <label className={cn(
                                "flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                                files.length >= 2 
                                    ? "border-zinc-800 bg-zinc-900/50 cursor-not-allowed opacity-50" 
                                    : "border-zinc-700 hover:border-orange-500/50 hover:bg-zinc-900"
                            )}>
                                <div className="flex flex-col items-center gap-2 text-zinc-500">
                                    {uploadingFile ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                                    <span className="text-xs font-medium">Clique para adicionar (.txt, .md, .pdf)</span>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".txt,.md,.docx,.pdf" 
                                    onChange={handleFileUpload} 
                                    disabled={files.length >= 2 || uploadingFile}
                                />
                            </label>
                        </div>

                        <div className="space-y-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-zinc-900 rounded">
                                            <FileText className="w-4 h-4 text-zinc-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm text-zinc-200 truncate">{file.name}</p>
                                            <a href={file.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline truncate block">Ver arquivo</a>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-zinc-600 hover:text-red-500 p-2 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {files.length === 0 && (
                                <p className="text-center text-xs text-zinc-600 py-4 italic">Nenhum arquivo anexado.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    </div>
  );
}
