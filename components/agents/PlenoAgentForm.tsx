
'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLevel, PipelineStage, AgentTriggerConfig, AgentLink } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Bot, Save, Briefcase, Mic2, AlertOctagon, ShieldCheck, FileText, Upload, 
    Trash2, Loader2, Info, Zap, Link as LinkIcon, Plus, ArrowRight, ArrowLeft, Brain, Target, Sparkles, PlayCircle, Phone
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { AgentTriggerSelector } from './AgentTriggerSelector';
import { PromptGeneratorModal } from './PromptGeneratorModal';
import { AgentSimulator } from './AgentSimulator';

interface PlenoAgentFormProps {
  initialData?: Agent | null;
  companyId: string;
  onSuccess: () => void;
}

const ROLES = [
  "Vendedor Consultivo",
  "Executivo de Contas",
  "Suporte Técnico Nível 2",
  "Closer (Fechamento)",
  "Consultor de Sucesso do Cliente (CS)",
  "Representante Comercial"
];

const SALES_TECHNIQUES = [
    { id: 'spin', label: 'SPIN Selling', desc: 'Foca em Situação, Problema, Implicação e Necessidade.' },
    { id: 'bant', label: 'BANT', desc: 'Qualifica por Orçamento, Autoridade, Necessidade e Tempo.' },
    { id: 'challenger', label: 'Challenger Sale', desc: 'Desafia o cliente, ensina e assume o controle.' },
    { id: 'sandler', label: 'Sandler', desc: 'Foca em quebrar o padrão do vendedor tradicional.' },
    { id: 'consultative', label: 'Venda Consultiva', desc: 'Atua como um conselheiro confiável.' },
    { id: 'none', label: 'Sem Técnica Específica', desc: 'Apenas segue o prompt do sistema.' }
];

export function PlenoAgentForm({ initialData, companyId, onSuccess }: PlenoAgentFormProps) {
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- STATES ETAPA 1 (IDENTIDADE & GATILHOS) ---
  const [name, setName] = useState(initialData?.name || 'Agente Pleno');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [triggerConfig, setTriggerConfig] = useState<AgentTriggerConfig>(
      initialData?.trigger_config || { type: 'all_messages' }
  );
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  const [role, setRole] = useState(initialData?.personality_config?.role || ROLES[0]);
  const [tone, setTone] = useState(initialData?.personality_config?.tone || 'profissional e persuasivo');
  const [context, setContext] = useState((initialData as any)?.personality_config?.context || ''); 
  
  // --- STATES ETAPA 2 (CONHECIMENTO & TÉCNICA) ---
  const [systemPrompt, setSystemPrompt] = useState(initialData?.prompt_instruction || '');
  const [salesTechnique, setSalesTechnique] = useState((initialData as any)?.flow_config?.technique || 'consultative');
  
  const [negativePrompts, setNegativePrompts] = useState<string[]>(initialData?.personality_config?.negative_prompts || []);
  const [goldenRules, setGoldenRules] = useState<string[]>(initialData?.personality_config?.escape_rules || []); 
  
  // Files (Limite 10)
  const [files, setFiles] = useState<{name: string, url: string, type: string}[]>(
      (initialData?.knowledge_config?.text_files as any) || []
  );
  const [uploadingFile, setUploadingFile] = useState(false);

  // Links
  const [links, setLinks] = useState<AgentLink[]>(initialData?.links_config || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Transbordo
  const [reportPhones, setReportPhones] = useState<string[]>(initialData?.tools_config?.reporting_phones || []);
  const [newReportPhone, setNewReportPhone] = useState('');

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

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (files.length >= 10) {
          addToast({ type: 'warning', title: 'Limite Atingido', message: 'O Agente Pleno suporta no máximo 10 arquivos.' });
          return;
      }
      if (file.size > 5 * 1024 * 1024) { 
          addToast({ type: 'error', title: 'Muito Grande', message: 'Máximo 5MB por arquivo.' });
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

  const handleAddLink = () => {
      if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
      setLinks([...links, { title: newLinkTitle, url: newLinkUrl }]);
      setNewLinkTitle('');
      setNewLinkUrl('');
  };

  const handleAddReportPhone = () => {
    const cleaned = newReportPhone.replace(/\D/g, '');
    if (cleaned.length < 10) return;
    if (!reportPhones.includes(cleaned)) {
        setReportPhones([...reportPhones, cleaned]);
        setNewReportPhone('');
    }
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

          // Compilação Inteligente do Prompt
          // O Pleno injeta a técnica de vendas automaticamente no prompt se ela não estiver lá
          let finalPrompt = systemPrompt;
          const techniqueObj = SALES_TECHNIQUES.find(t => t.id === salesTechnique);
          if (techniqueObj && salesTechnique !== 'none') {
              finalPrompt = `[DIRETRIZ ESTRATÉGICA: Utilize a técnica ${techniqueObj.label} (${techniqueObj.desc})].\n\n${systemPrompt}`;
          }

          const personalityConfig = {
              role,
              tone,
              context, 
              negative_prompts: negativePrompts,
              escape_rules: goldenRules 
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

          // Pleno usa reporting_phones no tools_config
          const toolsConfig = {
            reporting_phones: reportPhones
          };

          // Armazenamos a técnica no flow_config para recuperar na edição (mesmo que não usemos nodes visuais)
          const flowConfig = { technique: salesTechnique };

          const payload = {
              company_id: companyId,
              name,
              level: 'pleno' as AgentLevel,
              prompt_instruction: finalPrompt,
              personality_config: personalityConfig,
              knowledge_config: knowledgeConfig,
              tools_config: toolsConfig,
              trigger_config: triggerConfig,
              links_config: links,
              flow_config: flowConfig,
              is_default: isDefault,
              is_active: isActive,
              model: 'gemini-3-flash-preview', 
              transcription_enabled: true
          };

          if (initialData?.id) {
              const { error } = await supabase.from('agents').update(payload).eq('id', initialData.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('agents').insert(payload);
              if (error) throw error;
          }

          addToast({ type: 'success', title: 'Agente Pleno Salvo', message: 'Configurações avançadas aplicadas.' });
          onSuccess();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao Salvar', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Zap className="w-8 h-8 text-green-500" />
                    Configurar Agente Pleno
                </h2>
                <p className="text-zinc-400 text-sm mt-1">Vendas consultivas, qualificação e maior capacidade de contexto.</p>
            </div>
            
            {/* PROGRESSO */}
            <div className="flex items-center gap-2">
                <div className={cn("h-2 w-12 rounded-full transition-all", step >= 1 ? "bg-green-500" : "bg-zinc-800")} />
                <div className={cn("h-2 w-12 rounded-full transition-all", step >= 2 ? "bg-green-500" : "bg-zinc-800")} />
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
                                <Input value={name} onChange={e => setName(e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Ricardo Vendas" autoFocus />
                            </div>
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
                                    <Input value={tone} onChange={e => setTone(e.target.value)} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Persuasivo" />
                                </div>
                            </div>
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
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Quando ativar?</CardTitle></CardHeader>
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

        {/* --- ETAPA 2: CONHECIMENTO & TÉCNICA --- */}
        {step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-8">
                
                {/* Lado Esquerdo: Cérebro */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/40 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                <Bot className="w-4 h-4 text-green-500" /> Instruções (System Prompt)
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
                                    className="bg-zinc-950 border-zinc-800 min-h-[250px] font-mono text-xs leading-relaxed" 
                                    placeholder="Instrua o agente sobre como se comportar, o que perguntar e como conduzir a venda..." 
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                                    <Target className="w-3 h-3 text-purple-500" /> Técnica de Venda
                                </label>
                                <select 
                                    value={salesTechnique} 
                                    onChange={e => setSalesTechnique(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 outline-none"
                                >
                                    {SALES_TECHNIQUES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label} - {t.desc}</option>
                                    ))}
                                </select>
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
                        <CardHeader><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><FileText className="w-4 h-4 text-orange-500" /> Base de Conhecimento</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-lg">
                                <p className="text-xs text-orange-200/80 leading-relaxed mb-3">
                                    O Agente Pleno pode ler até <strong>10 arquivos</strong> (PDF, DOCX, TXT) para usar como contexto.
                                </p>
                                
                                <label className={cn("flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors", files.length >= 10 ? "border-zinc-800 opacity-50 cursor-not-allowed" : "border-zinc-700 hover:border-orange-500/50 hover:bg-zinc-900")}>
                                    <div className="flex flex-col items-center gap-1 text-zinc-500">
                                        {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                        <span className="text-xs font-medium">Adicionar Arquivo</span>
                                    </div>
                                    <input type="file" className="hidden" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} disabled={files.length >= 10 || uploadingFile} />
                                </label>
                            </div>

                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded group">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                                            <span className="text-xs text-zinc-200 truncate">{file.name}</span>
                                        </div>
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
                                <Button size="sm" onClick={handleAddLink} className="h-8 bg-cyan-600 hover:bg-cyan-500 px-2"><Plus className="w-4 h-4" /></Button>
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

                    <div className="flex justify-between pt-4 border-t border-zinc-800 mt-4">
                        <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsSimulatorOpen(true)} variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300">
                                <PlayCircle className="w-4 h-4 mr-2" /> Testar
                            </Button>
                            <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-500/20">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Finalizar
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
            systemPrompt={systemPrompt}
            agentName={name}
            contextFiles={files.map(f => f.name)}
        />
    </div>
  );
}
