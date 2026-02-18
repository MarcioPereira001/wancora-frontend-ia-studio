
'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLevel, PipelineStage, AgentTriggerConfig, AgentLink, VerbosityLevel, EmojiLevel, AgentTimingConfig } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Bot, Save, Briefcase, Mic2, ShieldCheck, FileText, Upload, 
    Trash2, Loader2, Info, Zap, Link as LinkIcon, Plus, ArrowRight, ArrowLeft, 
    Brain, Settings, Cloud, Calendar, Database, Phone, MessageSquare, Smile, Target, Sparkles, PlayCircle, RefreshCw, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { AgentTriggerSelector } from './AgentTriggerSelector';
import { api } from '@/services/api';
import { PromptGeneratorModal } from './PromptGeneratorModal';
import { AgentSimulator } from './AgentSimulator';
import { buildSystemPrompt } from '@/lib/ai/promptBuilder'; // Engine

interface SeniorAgentFormProps {
  initialData?: Agent | null;
  companyId: string;
  onSuccess: () => void;
}

const ROLES = [
  "Gerente de Contas",
  "Consultor Sênior",
  "Especialista Técnico",
  "Closer Enterprise",
  "Assistente Executivo",
  "Coordenador de Suporte",
  "Outro (Personalizado)"
];

const SALES_TECHNIQUES = [
    { id: 'spin', label: 'SPIN Selling', desc: 'Foca em Situação, Problema, Implicação e Necessidade.' },
    { id: 'bant', label: 'BANT', desc: 'Qualifica por Orçamento, Autoridade, Necessidade e Tempo.' },
    { id: 'challenger', label: 'Challenger Sale', desc: 'Desafia o cliente, ensina e assume o controle.' },
    { id: 'sandler', label: 'Sandler', desc: 'Foca em quebrar o padrão do vendedor tradicional.' },
    { id: 'consultative', label: 'Venda Consultiva', desc: 'Atua como um conselheiro confiável.' },
];

const MENTAL_TRIGGERS_OPTIONS = [
    { id: 'scarcity', label: 'Escassez' },
    { id: 'urgency', label: 'Urgência' },
    { id: 'authority', label: 'Autoridade' },
    { id: 'social_proof', label: 'Prova Social' },
    { id: 'reciprocity', label: 'Reciprocidade' },
    { id: 'novelty', label: 'Novidade' }
];

export function SeniorAgentForm({ initialData, companyId, onSuccess }: SeniorAgentFormProps) {
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- STATES ETAPA 1 (IDENTIDADE & GATILHOS) ---
  const [name, setName] = useState(initialData?.name || 'Agente Sênior');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [triggerConfig, setTriggerConfig] = useState<AgentTriggerConfig>(
      initialData?.trigger_config || { type: 'all_messages' }
  );
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // PERSONALIDADE
  const [role, setRole] = useState(initialData?.personality_config?.role || ROLES[0]);
  const [customRole, setCustomRole] = useState(initialData?.personality_config?.role && !ROLES.includes(initialData.personality_config.role) ? initialData.personality_config.role : '');
  const [roleDescription, setRoleDescription] = useState(initialData?.personality_config?.role_description || '');

  const [tone, setTone] = useState(initialData?.personality_config?.tone || 'profissional e estratégico');
  const [context, setContext] = useState((initialData as any)?.personality_config?.context || ''); 
  
  // NOVAS CONFIGS V5
  const [verbosity, setVerbosity] = useState<VerbosityLevel>(initialData?.personality_config?.verbosity || 'standard');
  const [emojiLevel, setEmojiLevel] = useState<EmojiLevel>(initialData?.personality_config?.emoji_level || 'moderate');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(initialData?.personality_config?.mental_triggers || []);
  
  // Config de Tempo (Humanizado: 20s - 120s)
  const [timing, setTiming] = useState<AgentTimingConfig>(initialData?.flow_config?.timing || { min_delay_seconds: 20, max_delay_seconds: 120 });

  // --- STATES ETAPA 2 (CÉREBRO & CONHECIMENTO) ---
  const [systemPrompt, setSystemPrompt] = useState(initialData?.prompt_instruction || '');
  const [salesTechnique, setSalesTechnique] = useState((initialData as any)?.flow_config?.technique || 'consultative');
  
  const [negativePrompts, setNegativePrompts] = useState<string[]>(initialData?.personality_config?.negative_prompts || []);
  const [goldenRules, setGoldenRules] = useState<string[]>(initialData?.personality_config?.escape_rules || []); 
  
  // Files (Limite 20)
  const [files, setFiles] = useState<{name: string, url: string, type: string}[]>(
      (initialData?.knowledge_config?.text_files as any) || []
  );
  const [uploadingFile, setUploadingFile] = useState(false);
  const [links, setLinks] = useState<AgentLink[]>(initialData?.links_config || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // --- STATES ETAPA 3 (TOOLS & INTEGRAÇÕES) ---
  const [useDrive, setUseDrive] = useState(initialData?.tools_config?.drive_integration || false);
  const [driveFolderId, setDriveFolderId] = useState(initialData?.tools_config?.drive_folder_id || '');
  const [useCalendar, setUseCalendar] = useState(initialData?.tools_config?.calendar_integration || false);
  const [useCRM, setUseCRM] = useState(initialData?.tools_config?.crm_integration || false);
  const [reportPhones, setReportPhones] = useState<string[]>(initialData?.tools_config?.reporting_phones || []);
  const [newReportPhone, setNewReportPhone] = useState('');

  // Drive Folders List
  const [folders, setFolders] = useState<{id: string, name: string}[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [syncingFolder, setSyncingFolder] = useState(false);

  // MODAIS
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Init
  useEffect(() => {
      const fetchStages = async () => {
          const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
          if (data) setStages(data as PipelineStage[]);
      };
      fetchStages();
  }, [companyId]);

  // Load Folders only when reaching Step 3 and Drive is enabled
  useEffect(() => {
      if (step === 3 && useDrive && folders.length === 0) {
          fetchFolders();
      }
  }, [step, useDrive]);

  const fetchFolders = async () => {
      setLoadingFolders(true);
      try {
          const res = await api.post('/cloud/google/list-remote', { companyId });
          if (res.files) {
              const flds = res.files.filter((f: any) => f.is_folder || f.mimeType === 'application/vnd.google-apps.folder');
              setFolders(flds);
          }
      } catch (e) {
          console.error(e);
          addToast({ type: 'error', title: 'Erro Drive', message: 'Falha ao listar pastas do Google Drive.' });
      } finally {
          setLoadingFolders(false);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (files.length >= 20) {
          addToast({ type: 'warning', title: 'Limite Atingido', message: 'O Agente Sênior suporta no máximo 20 arquivos.' });
          return;
      }
      if (file.size > 10 * 1024 * 1024) { 
          addToast({ type: 'error', title: 'Muito Grande', message: 'Máximo 10MB por arquivo.' });
          return;
      }

      setUploadingFile(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, companyId);
          setFiles(prev => [...prev, { name: file.name, url: publicUrl, type: 'text' }]);
          addToast({ type: 'success', title: 'Upload Concluído', message: 'Arquivo adicionado.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setUploadingFile(false);
          e.target.value = '';
      }
  };

  const handleSyncFolder = async () => {
      if (!driveFolderId) return;
      setSyncingFolder(true);
      try {
          // Importa a pasta selecionada para o cache do sistema para que a IA possa buscar nela
          await api.post('/cloud/google/import', {
              companyId,
              files: [{ id: driveFolderId, name: 'Agent Folder', mimeType: 'application/vnd.google-apps.folder' }],
              currentFolderId: null
          });
          addToast({ type: 'success', title: 'Sincronizado', message: 'Pasta indexada para o agente.' });
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao sincronizar pasta.' });
      } finally {
          setSyncingFolder(false);
      }
  };

  const handleAddReportPhone = () => {
      const cleaned = newReportPhone.replace(/\D/g, '');
      if (cleaned.length < 10) return;
      if (!reportPhones.includes(cleaned)) {
          setReportPhones([...reportPhones, cleaned]);
          setNewReportPhone('');
      }
  };

  const toggleTrigger = (id: string) => {
    setSelectedTriggers(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const buildCurrentAgent = (): any => {
      const finalRole = role === 'Outro (Personalizado)' ? customRole : role;
      return {
          name,
          level: 'senior',
          prompt_instruction: systemPrompt,
          personality_config: {
              role: finalRole,
              role_description: roleDescription,
              tone,
              context,
              negative_prompts: negativePrompts,
              escape_rules: goldenRules,
              verbosity,
              emoji_level: emojiLevel,
              mental_triggers: selectedTriggers
          },
          knowledge_config: { text_files: files },
          links_config: links,
          flow_config: { technique: salesTechnique, timing }
      };
  };

  const handleSave = async () => {
      if (!name.trim() || !systemPrompt.trim()) {
          addToast({ type: 'warning', title: 'Campos Obrigatórios', message: 'Nome e Instrução do Sistema são essenciais.' });
          return;
      }

      setLoading(true);
      try {
          // Check Default Conflict
          if (isDefault) {
               const { data: existingDefault } = await supabase
                  .from('agents')
                  .select('id, name')
                  .eq('company_id', companyId)
                  .eq('is_default', true)
                  .neq('id', initialData?.id || 'new')
                  .maybeSingle();
               
               if (existingDefault) {
                   if (!confirm(`O agente "${existingDefault.name}" já é o Padrão. Substituir?`)) {
                       setLoading(false);
                       return;
                   }
                   await supabase.from('agents').update({ is_default: false }).eq('id', existingDefault.id);
               }
          }

          // Define Cargo Final
          const finalRole = role === 'Outro (Personalizado)' ? customRole : role;

          let finalPrompt = systemPrompt;

          const personalityConfig = {
              role: finalRole,
              role_description: roleDescription,
              tone,
              context, 
              negative_prompts: negativePrompts,
              escape_rules: goldenRules,
              verbosity,
              emoji_level: emojiLevel,
              mental_triggers: selectedTriggers
          };

          const knowledgeConfig = {
              text_files: files.map(f => ({ 
                  id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                  name: f.name, 
                  type: 'text' as const, 
                  url: f.url 
              })),
              media_files: [] 
          };

          const toolsConfig = {
              drive_integration: useDrive,
              drive_folder_id: useDrive ? driveFolderId : null,
              calendar_integration: useCalendar,
              crm_integration: useCRM,
              reporting_phones: reportPhones
          };

          const flowConfig = { technique: salesTechnique, timing };

          const payload = {
              company_id: companyId,
              name,
              level: 'senior' as AgentLevel,
              prompt_instruction: finalPrompt,
              personality_config: personalityConfig,
              knowledge_config: knowledgeConfig,
              tools_config: toolsConfig,
              trigger_config: triggerConfig,
              links_config: links,
              flow_config: flowConfig,
              is_default: isDefault,
              is_active: isActive,
              model: 'gemini-1.5-flash', // ATUALIZADO: Modelo Comercial Padrão (Sem 'latest')
              transcription_enabled: true
          };

          if (initialData?.id) {
              const { error } = await supabase.from('agents').update(payload).eq('id', initialData.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('agents').insert(payload);
              if (error) throw error;
          }

          addToast({ type: 'success', title: 'Agente Sênior Salvo', message: 'Configurações de alto nível aplicadas.' });
          onSuccess();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao Salvar', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    setLinks([...links, { title: newLinkTitle, url: newLinkUrl }]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  // Compila o prompt completo para o simulador
  const fullSimulationPrompt = buildSystemPrompt(buildCurrentAgent());

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Brain className="w-8 h-8 text-purple-500" />
                    Configurar Agente Sênior
                </h2>
                <p className="text-zinc-400 text-sm mt-1">Autonomia total, acesso a ferramentas e raciocínio complexo.</p>
            </div>
            
            {/* PROGRESSO */}
            <div className="flex items-center gap-2">
                <div className={cn("h-2 w-8 rounded-full transition-all", step >= 1 ? "bg-purple-500" : "bg-zinc-800")} />
                <div className={cn("h-2 w-8 rounded-full transition-all", step >= 2 ? "bg-purple-500" : "bg-zinc-800")} />
                <div className={cn("h-2 w-8 rounded-full transition-all", step >= 3 ? "bg-purple-500" : "bg-zinc-800")} />
            </div>
        </div>

        {/* --- ETAPA 1: IDENTIDADE --- */}
        {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-8">
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-500" /> Perfil Profissional</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Agente</label>
                                <Input value={name} onChange={e => setName(e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Roberto Diretor" autoFocus />
                            </div>
                            
                            {/* CARGO DINÂMICO */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Cargo</label>
                                    <select 
                                        value={role} onChange={e => setRole(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 outline-none"
                                    >
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tom de Voz</label>
                                    <Input value={tone} onChange={e => setTone(e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Estratégico" />
                                </div>
                            </div>
                            
                             {/* CAMPO DE CARGO CUSTOMIZADO */}
                             {role === 'Outro (Personalizado)' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                     <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Cargo Personalizado</label>
                                     <Input value={customRole} onChange={e => setCustomRole(e.target.value)} className="bg-zinc-950 border-zinc-800 mb-2" placeholder="Ex: Especialista em Energia Solar" />
                                     
                                     <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Descrição da Função (O que ele faz?)</label>
                                     <Textarea value={roleDescription} onChange={e => setRoleDescription(e.target.value)} className="bg-zinc-950 border-zinc-800 h-20 text-xs" placeholder="Ex: Tira dúvidas técnicas e agenda visitas..." />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Contexto da Empresa</label>
                                <Textarea 
                                    value={context} onChange={e => setContext(e.target.value)} 
                                    className="bg-zinc-950 border-zinc-800 min-h-[100px]" 
                                    placeholder="Quem somos, o que vendemos, quem é nosso público..." 
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* CONFIGURAÇÃO DE FLUXO E EMOJIS (V5) */}
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-purple-500" /> Estilo de Conversa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            {/* Verbosity */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Fluxo de Conversa</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        onClick={() => setVerbosity('minimalist')}
                                        className={cn("p-2 rounded border text-xs text-center transition-all", verbosity === 'minimalist' ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:bg-zinc-900")}
                                    >
                                        Minimalista
                                    </button>
                                    <button 
                                        onClick={() => setVerbosity('standard')}
                                        className={cn("p-2 rounded border text-xs text-center transition-all", verbosity === 'standard' ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:bg-zinc-900")}
                                    >
                                        Padrão
                                    </button>
                                    <button 
                                        onClick={() => setVerbosity('mixed')}
                                        className={cn("p-2 rounded border text-xs text-center transition-all", verbosity === 'mixed' ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:bg-zinc-900")}
                                    >
                                        Misto
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    {verbosity === 'minimalist' ? 'Objetivo, poucas palavras. Ideal para triagem.' : 
                                     verbosity === 'standard' ? 'Equilibrado e cordial.' : 
                                     'Começa curto, mas aprofunda nas explicações se necessário.'}
                                </p>
                            </div>

                            {/* Emojis */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-1">
                                    <Smile className="w-3 h-3" /> Intensidade de Emojis
                                </label>
                                <input 
                                    type="range" min="0" max="2" step="1" 
                                    value={emojiLevel === 'rare' ? 0 : emojiLevel === 'moderate' ? 1 : 2}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEmojiLevel(val === 0 ? 'rare' : val === 1 ? 'moderate' : 'frequent');
                                    }}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-500 mt-1 uppercase font-bold">
                                    <span>Raro/Nunca</span>
                                    <span>Moderado</span>
                                    <span>Frequente 🚀</span>
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    {/* NOVO: Tempo de Resposta */}
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                             <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                <Clock className="w-3 h-3 text-emerald-500" /> Tempo de Resposta (Delay)
                            </label>
                            <div className="flex gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block">Mínimo (seg)</label>
                                    <Input 
                                        type="number" min="0" max="60"
                                        value={timing.min_delay_seconds}
                                        onChange={(e) => setTiming(prev => ({ ...prev, min_delay_seconds: Number(e.target.value) }))}
                                        className="bg-zinc-900 border-zinc-800 h-8 text-xs w-20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block">Máximo (seg)</label>
                                    <Input 
                                        type="number" min="1" max="120"
                                        value={timing.max_delay_seconds}
                                        onChange={(e) => setTiming(prev => ({ ...prev, max_delay_seconds: Number(e.target.value) }))}
                                        className="bg-zinc-900 border-zinc-800 h-8 text-xs w-20"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-2">
                                O agente irá simular digitação por um tempo aleatório entre o mínimo e máximo, somado ao tamanho do texto.
                            </p>
                        </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <div>
                            <span className="text-sm font-bold text-zinc-200">Status do Agente</span>
                            <p className="text-[10px] text-zinc-500">Se desativado, ele não responderá a ninguém.</p>
                        </div>
                        <div 
                            onClick={() => setIsActive(!isActive)}
                            className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", isActive ? "bg-green-600" : "bg-zinc-700")}
                        >
                            <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", isActive ? "left-7" : "left-1")} />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-yellow-500">
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Gatilhos</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <AgentTriggerSelector 
                                value={triggerConfig} 
                                onChange={setTriggerConfig} 
                                stages={stages}
                            />
                            
                            <div className="flex items-center gap-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800 mt-2">
                                <div 
                                    onClick={() => setIsDefault(!isDefault)}
                                    className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors shrink-0", isDefault ? "bg-yellow-500" : "bg-zinc-700")}
                                >
                                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", isDefault ? "left-6" : "left-1")} />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-zinc-300">Tornar Agente Padrão (Fallback)</span>
                                    <p className="text-[10px] text-zinc-500">Responde se nenhum outro gatilho disparar.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setStep(2)} className="bg-zinc-100 text-zinc-900 hover:bg-white w-40 font-bold">
                            Próxima Etapa <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* --- ETAPA 2: CÉREBRO --- */}
        {step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-8">
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                <Bot className="w-4 h-4 text-purple-500" /> Prompt Mestre
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Instrução Mestra</label>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1" onClick={() => setIsGeneratorOpen(true)}>
                                        <Sparkles className="w-3 h-3" /> Mágica IA
                                    </Button>
                                </div>
                                <Textarea 
                                    value={systemPrompt} 
                                    onChange={e => setSystemPrompt(e.target.value)} 
                                    className="bg-zinc-950 border-zinc-800 min-h-[300px] font-mono text-xs leading-relaxed" 
                                    placeholder="Defina a inteligência superior do agente..." 
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                    <Target className="w-3 h-3 text-blue-500" /> Metodologia
                                </label>
                                <select 
                                    value={salesTechnique} 
                                    onChange={e => setSalesTechnique(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 outline-none"
                                >
                                    {SALES_TECHNIQUES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* GATILHOS MENTAIS */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                    <Brain className="w-3 h-3 text-pink-500" /> Gatilhos Mentais
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MENTAL_TRIGGERS_OPTIONS.map(trig => (
                                        <div 
                                            key={trig.id}
                                            onClick={() => toggleTrigger(trig.id)}
                                            className={cn(
                                                "p-2 rounded border text-xs cursor-pointer select-none transition-colors",
                                                selectedTriggers.includes(trig.id) ? "bg-pink-500/10 border-pink-500/50 text-pink-200" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                            )}
                                        >
                                            {trig.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-red-500">
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-red-500" /> Guardrails (Segurança)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">O que NÃO fazer (Negative Prompts)</label>
                                <TagInput tags={negativePrompts} onChange={setNegativePrompts} placeholder="Ex: Não fale de política..." />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Regras de Escape (Chamar Humano)</label>
                                <TagInput tags={goldenRules} onChange={setGoldenRules} placeholder="Ex: Cliente pediu cancelamento..." />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lado Direito: Arquivos e Links */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><FileText className="w-4 h-4 text-orange-500" /> Base Expandida</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-lg">
                                <p className="text-xs text-orange-200/80 leading-relaxed mb-3">
                                    O Agente Sênior suporta até <strong>20 arquivos</strong>.
                                </p>
                                <label className={cn("flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors", files.length >= 20 ? "border-zinc-800 opacity-50 cursor-not-allowed" : "border-zinc-700 hover:border-orange-500/50 hover:bg-zinc-900")}>
                                    <div className="flex flex-col items-center gap-1 text-zinc-500">
                                        {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                        <span className="text-xs font-medium">Upload Arquivo</span>
                                    </div>
                                    <input type="file" className="hidden" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} disabled={files.length >= 20 || uploadingFile} />
                                </label>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded group">
                                        <span className="text-xs text-zinc-200 truncate">{file.name}</span>
                                        <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-cyan-500" /> Links Estratégicos</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Título" className="bg-zinc-950 border-zinc-800 text-xs h-8" />
                                <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="URL" className="bg-zinc-950 border-zinc-800 text-xs h-8" />
                                <Button size="sm" onClick={() => { if(newLinkTitle && newLinkUrl) { setLinks([...links, {title: newLinkTitle, url: newLinkUrl}]); setNewLinkTitle(''); setNewLinkUrl(''); }}} className="h-8 bg-cyan-600 hover:bg-cyan-500 px-2"><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="space-y-1">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded text-xs group">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-zinc-300">{link.title}</span>
                                            <span className="text-zinc-500 truncate">{link.url}</span>
                                        </div>
                                        <button onClick={() => setLinks(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="flex justify-between pt-4 border-t border-zinc-800 mt-4">
                        <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                        <Button onClick={() => setStep(3)} className="bg-zinc-100 text-zinc-900 hover:bg-white w-40 font-bold">
                            Próxima Etapa <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* --- ETAPA 3: TOOLS & INTEGRAÇÕES --- */}
        {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-8">
                
                {/* Ferramentas */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-pink-500" /> Ferramentas Ativas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            {/* GOOGLE DRIVE TOOL */}
                            <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Cloud className="w-5 h-5 text-blue-400" />
                                        <span className="text-sm font-bold text-zinc-200">Google Drive (Envio de Arquivos)</span>
                                    </div>
                                    <div 
                                        onClick={() => setUseDrive(!useDrive)}
                                        className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", useDrive ? "bg-green-600" : "bg-zinc-700")}
                                    >
                                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", useDrive ? "left-6" : "left-1")} />
                                    </div>
                                </div>
                                {useDrive && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Pasta Alvo (Onde a IA busca arquivos)</label>
                                        {loadingFolders ? (
                                            <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando pastas...</div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <select 
                                                    value={driveFolderId} 
                                                    onChange={(e) => setDriveFolderId(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white"
                                                >
                                                    <option value="">Selecione uma pasta...</option>
                                                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                </select>
                                                <Button size="sm" onClick={handleSyncFolder} disabled={syncingFolder || !driveFolderId} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                                    {syncingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* CALENDAR TOOL */}
                            <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-purple-400" />
                                    <span className="text-sm font-bold text-zinc-200">Agendamento (Calendar)</span>
                                </div>
                                <div 
                                    onClick={() => setUseCalendar(!useCalendar)}
                                    className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", useCalendar ? "bg-green-600" : "bg-zinc-700")}
                                >
                                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", useCalendar ? "left-6" : "left-1")} />
                                </div>
                            </div>

                            {/* CRM TOOL */}
                            <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="w-5 h-5 text-yellow-400" />
                                    <span className="text-sm font-bold text-zinc-200">Consulta ao CRM</span>
                                </div>
                                <div 
                                    onClick={() => setUseCRM(!useCRM)}
                                    className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", useCRM ? "bg-green-600" : "bg-zinc-700")}
                                >
                                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", useCRM ? "left-6" : "left-1")} />
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>

                {/* Relatórios & Finalização */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-blue-500">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                <Phone className="w-4 h-4 text-blue-500" /> Transbordo & Relatórios
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-zinc-400">
                                Quando a IA transferir para um humano, enviar relatório para estes números:
                            </p>
                            <div className="flex gap-2">
                                <Input 
                                    value={newReportPhone} 
                                    onChange={e => setNewReportPhone(e.target.value)} 
                                    placeholder="551199..." 
                                    className="bg-zinc-950 border-zinc-800"
                                />
                                <Button size="sm" onClick={handleAddReportPhone} className="bg-blue-600 hover:bg-blue-500">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {reportPhones.map((phone, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800 text-xs">
                                        <span className="text-zinc-300">{phone}</span>
                                        <button onClick={() => setReportPhones(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between pt-4 border-t border-zinc-800 mt-4">
                        <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsSimulatorOpen(true)} variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300">
                                <PlayCircle className="w-4 h-4 mr-2" /> Testar
                            </Button>
                            <Button onClick={handleSave} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-500/20">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Finalizar Sênior
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAIS */}
        <PromptGeneratorModal 
            isOpen={isGeneratorOpen} 
            onClose={() => setIsGeneratorOpen(false)} 
            onGenerated={(text) => setSystemPrompt(text)} 
        />
        
        <AgentSimulator 
            isOpen={isSimulatorOpen} 
            onClose={() => setIsSimulatorOpen(false)} 
            systemPrompt={fullSimulationPrompt} // USA FULL PROMPT
            agentName={name}
            contextFiles={files.map(f => f.name)}
        />
    </div>
  );
}

const Check = ({size, className}: any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>;
