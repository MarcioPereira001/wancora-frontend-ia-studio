
'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLevel, PipelineStage, AgentTriggerConfig, AgentLink, VerbosityLevel, EmojiLevel, AgentTimingConfig } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Save, Briefcase, Mic2, AlertOctagon, ShieldCheck, FileText, Upload, Trash2, Loader2, Info, Zap, Link as LinkIcon, Plus, PlayCircle, Phone, Smile, MessageSquare, Sparkles, Clock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { AgentTriggerSelector } from './AgentTriggerSelector';
import { PromptGeneratorModal } from './PromptGeneratorModal';
import { AgentSimulator } from './AgentSimulator';
import { buildSystemPrompt } from '@/lib/ai/promptBuilder'; // Import da Engine

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
  
  // Gatilhos e Padrão
  const [triggerConfig, setTriggerConfig] = useState<AgentTriggerConfig>(
      initialData?.trigger_config || { type: 'all_messages' }
  );
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // Personality Config
  const [role, setRole] = useState(initialData?.personality_config?.role || ROLES[0]);
  const [tone, setTone] = useState(initialData?.personality_config?.tone || 'profissional');
  const [context, setContext] = useState((initialData as any)?.personality_config?.context || ''); 
  const [negativePrompts, setNegativePrompts] = useState<string[]>(initialData?.personality_config?.negative_prompts || []);
  const [goldenRules, setGoldenRules] = useState<string[]>(initialData?.personality_config?.escape_rules || []); 
  
  // Novas Configs V5
  const [verbosity, setVerbosity] = useState<VerbosityLevel>(initialData?.personality_config?.verbosity || 'minimalist');
  const [emojiLevel, setEmojiLevel] = useState<EmojiLevel>(initialData?.personality_config?.emoji_level || 'moderate');

  // Config de Tempo (Humanizado: 20s - 120s)
  const [timing, setTiming] = useState<AgentTimingConfig>(initialData?.flow_config?.timing || { min_delay_seconds: 20, max_delay_seconds: 120 });

  // Core Prompt
  const [systemPrompt, setSystemPrompt] = useState(initialData?.prompt_instruction || '');

  // Files
  const [files, setFiles] = useState<{name: string, url: string, type: string}[]>(
      (initialData?.knowledge_config?.text_files as any) || []
  );
  const [uploadingFile, setUploadingFile] = useState(false);

  // Links Config
  const [links, setLinks] = useState<AgentLink[]>(initialData?.links_config || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Transbordo (Report Phones)
  const [reportPhones, setReportPhones] = useState<string[]>(initialData?.tools_config?.reporting_phones || []);
  const [newReportPhone, setNewReportPhone] = useState('');

  // MODAIS
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Carrega estágios do funil para o seletor de gatilho
  useEffect(() => {
      const fetchStages = async () => {
          const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
          if (data) setStages(data as PipelineStage[]);
      };
      fetchStages();
  }, [companyId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (files.length >= 2) {
          addToast({ type: 'warning', title: 'Limite Atingido', message: 'O Agente Junior suporta no máximo 2 arquivos.' });
          return;
      }

      if (file.size > 2 * 1024 * 1024) { 
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

  const handleAddLink = () => {
      if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
      setLinks([...links, { title: newLinkTitle, url: newLinkUrl }]);
      setNewLinkTitle('');
      setNewLinkUrl('');
  };

  const handleRemoveLink = (index: number) => {
      setLinks(links.filter((_, i) => i !== index));
  };

  const handleAddReportPhone = () => {
      const cleaned = newReportPhone.replace(/\D/g, '');
      if (cleaned.length < 10) return;
      if (!reportPhones.includes(cleaned)) {
          setReportPhones([...reportPhones, cleaned]);
          setNewReportPhone('');
      }
  };

  // Constrói o agente temporário para simulação ou salvamento
  const buildCurrentAgent = (): any => {
      return {
          name,
          level: 'junior',
          prompt_instruction: systemPrompt,
          personality_config: {
              role,
              tone,
              context,
              negative_prompts: negativePrompts,
              escape_rules: goldenRules,
              verbosity,
              emoji_level: emojiLevel
          },
          knowledge_config: { text_files: files },
          links_config: links,
          flow_config: { timing }
      };
  };

  const handleSave = async () => {
      if (!name.trim() || !systemPrompt.trim()) {
          addToast({ type: 'warning', title: 'Campos Obrigatórios', message: 'Nome e Prompt do Sistema são essenciais.' });
          return;
      }

      setLoading(true);
      try {
          if (isDefault) {
               const { data: existingDefault } = await supabase
                  .from('agents')
                  .select('id, name')
                  .eq('company_id', companyId)
                  .eq('is_default', true)
                  .neq('id', initialData?.id || 'new') 
                  .maybeSingle();
               
               if (existingDefault) {
                   if (!confirm(`O agente "${existingDefault.name}" já é o Padrão. Deseja substituí-lo por este?`)) {
                       setLoading(false);
                       return;
                   }
                   await supabase.from('agents').update({ is_default: false }).eq('id', existingDefault.id);
               }
          }

          const personalityConfig = {
              role,
              tone,
              context, 
              negative_prompts: negativePrompts,
              escape_rules: goldenRules,
              verbosity, 
              emoji_level: emojiLevel 
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

          // Junior só usa reporting_phones no tools_config
          const toolsConfig = {
              reporting_phones: reportPhones
          };

          const flowConfig = {
              timing // Salva a config de tempo no flow
          };

          const payload = {
              company_id: companyId,
              name,
              level: 'junior' as AgentLevel,
              prompt_instruction: systemPrompt,
              personality_config: personalityConfig,
              knowledge_config: knowledgeConfig,
              tools_config: toolsConfig,
              flow_config: flowConfig,
              trigger_config: triggerConfig,
              links_config: links, 
              is_default: isDefault,
              is_active: isActive,
              model: 'gemini-1.5-flash', // ATUALIZADO: Modelo Comercial Padrão
              transcription_enabled: true
          };

          if (initialData?.id) {
              const { error } = await supabase.from('agents').update(payload).eq('id', initialData.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('agents').insert(payload);
              if (error) throw error;
          }

          addToast({ type: 'success', title: 'Agente Salvo', message: 'Configurações aplicadas com sucesso.' });
          onSuccess();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao Salvar', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  // Compila o prompt completo para o simulador
  const fullSimulationPrompt = buildSystemPrompt(buildCurrentAgent());

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
                <Button onClick={() => setIsSimulatorOpen(true)} variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300">
                    <PlayCircle className="w-4 h-4 mr-2" /> Testar Agente
                </Button>
                
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
                    Salvar
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUNA 1: GATILHOS & IDENTIDADE */}
            <div className="space-y-6">
                
                {/* Gatilhos */}
                <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-yellow-500">
                    <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Regras de Ativação</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <AgentTriggerSelector 
                            value={triggerConfig} 
                            onChange={setTriggerConfig} 
                            stages={stages}
                        />

                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                            <div>
                                <span className="text-sm font-bold text-zinc-300">Sentinela Padrão</span>
                                <p className="text-[10px] text-zinc-500">Ativar se nenhum outro agente corresponder.</p>
                            </div>
                            <div 
                                onClick={() => setIsDefault(!isDefault)}
                                className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", isDefault ? "bg-yellow-500" : "bg-zinc-700")}
                            >
                                <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", isDefault ? "left-6" : "left-1")} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

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

                {/* Relatórios (NOVO) */}
                <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-blue-500">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-blue-500" /> Notificação de Transbordo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-zinc-400">
                            Quem deve receber um alerta no WhatsApp quando este agente transferir para humano?
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
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1" onClick={() => setIsGeneratorOpen(true)}>
                                    <Sparkles className="w-3 h-3" /> Mágica IA
                                </Button>
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

                        {/* NOVO: Verbosidade e Emojis */}
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                             <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                <MessageSquare className="w-3 h-3 text-cyan-500" /> Estilo de Resposta
                            </label>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block">Fluxo (Tamanho)</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        <button onClick={() => setVerbosity('minimalist')} className={cn("text-[10px] py-1 rounded border", verbosity === 'minimalist' ? "bg-cyan-900 border-cyan-700 text-cyan-100" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>Curto</button>
                                        <button onClick={() => setVerbosity('standard')} className={cn("text-[10px] py-1 rounded border", verbosity === 'standard' ? "bg-cyan-900 border-cyan-700 text-cyan-100" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>Médio</button>
                                        <button onClick={() => setVerbosity('mixed')} className={cn("text-[10px] py-1 rounded border", verbosity === 'mixed' ? "bg-cyan-900 border-cyan-700 text-cyan-100" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>Misto</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block">Emojis</label>
                                    <input 
                                        type="range" min="0" max="2" step="1" 
                                        value={emojiLevel === 'rare' ? 0 : emojiLevel === 'moderate' ? 1 : 2}
                                        onChange={(e) => setEmojiLevel(Number(e.target.value) === 0 ? 'rare' : Number(e.target.value) === 1 ? 'moderate' : 'frequent')}
                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-zinc-500 mt-1 font-mono uppercase">
                                        <span>Raro</span><span>Moderado</span><span>Frequente</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* NOVO: Tempo de Resposta */}
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
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

                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                <AlertOctagon className="w-3 h-3 text-red-500" /> O que NÃO fazer
                            </label>
                            <TagInput 
                                tags={negativePrompts} 
                                onChange={setNegativePrompts} 
                                placeholder="Ex: Não use gírias..." 
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* COLUNA 3: CONHECIMENTO & RECURSOS */}
            <div className="space-y-6">
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

                {/* NOVO: CARD DE LINKS ESTRATÉGICOS */}
                <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-cyan-500" /> Links Estratégicos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-zinc-400">
                            Adicione links que o agente pode enviar quando o cliente pedir (Catálogo, Agenda, Site).
                        </p>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input 
                                    value={newLinkTitle} 
                                    onChange={e => setNewLinkTitle(e.target.value)} 
                                    placeholder="Ex: Agenda / Catálogo" 
                                    className="bg-zinc-950 border-zinc-800 text-xs h-8"
                                />
                                <Input 
                                    value={newLinkUrl} 
                                    onChange={e => setNewLinkUrl(e.target.value)} 
                                    placeholder="https://..." 
                                    className="bg-zinc-950 border-zinc-800 text-xs h-8"
                                />
                                <Button size="sm" onClick={handleAddLink} className="h-8 bg-cyan-600 hover:bg-cyan-500 px-2">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            
                            <div className="space-y-1">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded text-xs group">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-zinc-300">{link.title}</span>
                                            <span className="text-zinc-500 truncate">{link.url}</span>
                                        </div>
                                        <button onClick={() => handleRemoveLink(idx)} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {links.length === 0 && <p className="text-[10px] text-zinc-600 text-center py-2">Nenhum link adicionado.</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-orange-500" /> Base de Conhecimento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-lg">
                            <p className="text-xs text-orange-200/80 leading-relaxed mb-3">
                                O Agente Junior pode ler até <strong>2 arquivos de texto</strong> para usar como base de resposta.
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
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* MODAIS */}
        <PromptGeneratorModal 
            isOpen={isGeneratorOpen} 
            onClose={() => setIsGeneratorOpen(false)} 
            onGenerated={(text) => setSystemPrompt(text)} 
        />
        
        <AgentSimulator 
            isOpen={isSimulatorOpen} 
            onClose={() => setIsSimulatorOpen(false)} 
            systemPrompt={fullSimulationPrompt} // USA O FULL PROMPT AQUI!
            agentName={name}
            contextFiles={files.map(f => f.name)}
        />
    </div>
  );
}

const Check = ({size, className}: any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>;
