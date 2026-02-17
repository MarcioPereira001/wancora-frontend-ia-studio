'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { Agent, AgentLevel } from '@/types';
import { JuniorAgentForm } from '@/components/agents/JuniorAgentForm';
import { PlenoAgentForm } from '@/components/agents/PlenoAgentForm';
import { SeniorAgentForm } from '@/components/agents/SeniorAgentForm';
import { Loader2, Bot, Plus, Trash2, Cpu, Zap, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export default function AgentsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Nível selecionado para criação
  const [selectedLevel, setSelectedLevel] = useState<AgentLevel>('junior');

  const fetchAgents = async () => {
      if (!user?.company_id) return;
      setLoading(true);
      try {
          const { data } = await supabase
              .from('agents')
              .select('*')
              .eq('company_id', user.company_id)
              .order('name');
          
          setAgents((data as Agent[]) || []);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchAgents();
  }, [user?.company_id]);

  const handleDelete = async (id: string) => {
      if(!confirm("Tem certeza? Isso apagará o agente.")) return;
      await supabase.from('agents').delete().eq('id', id);
      addToast({ type: 'success', title: 'Apagado', message: 'Agente removido.' });
      fetchAgents();
      if(selectedAgent?.id === id) setSelectedAgent(null);
  };

  const handleSuccess = () => {
      fetchAgents();
      setIsCreating(false);
      setSelectedAgent(null);
  };

  // Renderização do CONSTRUTOR CORRETO (Roteamento de Wizards)
  const renderBuilder = () => {
      const targetLevel = selectedAgent ? selectedAgent.level : selectedLevel;
      const key = selectedAgent?.id || 'new'; // Força remontagem ao trocar

      if (targetLevel === 'senior') {
          return (
              <React.Fragment key={key}>
                  <SeniorAgentForm 
                      initialData={selectedAgent} 
                      companyId={user?.company_id || ''} 
                      onSuccess={handleSuccess} 
                  />
              </React.Fragment>
          );
      } 
      
      if (targetLevel === 'pleno') {
          return (
              <React.Fragment key={key}>
                  <PlenoAgentForm 
                      initialData={selectedAgent} 
                      companyId={user?.company_id || ''} 
                      onSuccess={handleSuccess} 
                  />
              </React.Fragment>
          );
      }

      // Default: Junior
      return (
          <React.Fragment key={key}>
              <JuniorAgentForm 
                  initialData={selectedAgent} 
                  companyId={user?.company_id || ''} 
                  onSuccess={handleSuccess} 
              />
          </React.Fragment>
      );
  };

  // Se não tiver selecionado nada, mostra lista
  if (!selectedAgent && !isCreating) {
      return (
          <div className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center">
                  <div>
                      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                          <Bot className="w-8 h-8 text-primary" /> Meus Agentes
                      </h1>
                      <p className="text-zinc-400 mt-1">Gerencie a inteligência da sua operação.</p>
                  </div>
                  <Button onClick={() => setIsCreating(true)} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                      <Plus className="w-4 h-4 mr-2" /> Novo Agente
                  </Button>
              </div>

              {loading ? (
                  <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>
              ) : agents.length === 0 ? (
                  <div className="text-center py-20 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                      <Bot className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                      <h3 className="text-zinc-300 font-bold text-lg">Nenhum agente criado</h3>
                      <p className="text-zinc-500 mt-2 mb-6">Crie seu primeiro funcionário digital agora.</p>
                      <Button onClick={() => setIsCreating(true)}>Criar Agente</Button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agents.map(agent => (
                          <div key={agent.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all group relative hover:-translate-y-1 duration-300 shadow-sm hover:shadow-lg">
                              <div className="flex justify-between items-start mb-4">
                                  <div className={cn("p-2 rounded-lg border border-white/5", 
                                      agent.level === 'junior' ? "bg-blue-500/10 text-blue-500" : 
                                      agent.level === 'pleno' ? "bg-green-500/10 text-green-500" : 
                                      "bg-purple-500/10 text-purple-500"
                                  )}>
                                      {agent.level === 'junior' ? <Bot size={20} /> : agent.level === 'pleno' ? <Zap size={20} /> : <Cpu size={20} />}
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleDelete(agent.id)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                                  </div>
                              </div>
                              <h3 className="text-lg font-bold text-white mb-1 truncate" title={agent.name}>{agent.name}</h3>
                              <div className="flex items-center gap-2 mb-4">
                                  <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded border", 
                                      agent.level === 'junior' ? "border-blue-500/30 text-blue-400 bg-blue-500/5" : 
                                      agent.level === 'pleno' ? "border-green-500/30 text-green-400 bg-green-500/5" : 
                                      "border-purple-500/30 text-purple-400 bg-purple-500/5"
                                  )}>
                                      Nível {agent.level}
                                  </span>
                                  <div className="flex items-center gap-1.5 ml-auto">
                                      <div className={cn("w-2 h-2 rounded-full animate-pulse", agent.is_active ? "bg-green-500" : "bg-zinc-600")} />
                                      <span className={cn("text-[10px] font-mono", agent.is_active ? "text-green-500" : "text-zinc-500")}>
                                          {agent.is_active ? 'ONLINE' : 'PAUSED'}
                                      </span>
                                  </div>
                              </div>
                              <Button variant="outline" className="w-full border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white transition-colors" onClick={() => setSelectedAgent(agent)}>
                                  Configurar
                              </Button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  }

  // TELA DE SELEÇÃO DE NÍVEL (Se estiver criando novo)
  if (isCreating && !selectedAgent) {
      return (
          <div className="max-w-5xl mx-auto p-8 animate-in zoom-in-95">
              <div className="flex items-center gap-4 mb-8">
                  <Button variant="ghost" onClick={() => setIsCreating(false)} className="hover:bg-zinc-800 text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5 mr-2" /> Voltar</Button>
                  <h1 className="text-2xl font-bold text-white">Escolha o Nível do Agente</h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* JUNIOR */}
                  <div 
                      onClick={() => { setSelectedLevel('junior'); setSelectedAgent({ level: 'junior' } as any); }}
                      className="bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 p-6 rounded-2xl cursor-pointer transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-blue-500/10 group"
                  >
                      <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform border border-blue-500/20">
                          <Bot size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Junior</h3>
                      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Ideal para triagem, FAQ e atendimento inicial simples. Respostas rápidas e curtas.</p>
                      <ul className="text-xs text-zinc-500 space-y-3 font-medium">
                          <li className="flex gap-2 items-center"><Check size={14} className="text-blue-500" /> Configuração Simplificada</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-blue-500" /> Respostas Curtas</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-blue-500" /> 2 Arquivos de Contexto</li>
                      </ul>
                  </div>

                  {/* PLENO */}
                  <div 
                      onClick={() => { setSelectedLevel('pleno'); setSelectedAgent({ level: 'pleno' } as any); }}
                      className="bg-zinc-900 border border-zinc-800 hover:border-green-500/50 p-6 rounded-2xl cursor-pointer transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-500/10 group relative overflow-hidden"
                  >
                      <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg">MAIS USADO</div>
                      <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 transition-transform border border-green-500/20">
                          <Zap size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">Pleno</h3>
                      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Especialista em vendas e qualificação. Usa técnicas como SPIN e BANT.</p>
                      <ul className="text-xs text-zinc-500 space-y-3 font-medium">
                          <li className="flex gap-2 items-center"><Check size={14} className="text-green-500" /> Técnicas de Vendas</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-green-500" /> Gatilhos Inteligentes</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-green-500" /> 10 Arquivos de Contexto</li>
                      </ul>
                  </div>

                  {/* SENIOR */}
                  <div 
                      onClick={() => { setSelectedLevel('senior'); setSelectedAgent({ level: 'senior' } as any); }}
                      className="bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 p-6 rounded-2xl cursor-pointer transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 group"
                  >
                      <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500 mb-6 group-hover:scale-110 transition-transform border border-purple-500/20">
                          <Cpu size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Sênior</h3>
                      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Agente autônomo com acesso a ferramentas externas (Drive, Agenda, CRM).</p>
                      <ul className="text-xs text-zinc-500 space-y-3 font-medium">
                          <li className="flex gap-2 items-center"><Check size={14} className="text-purple-500" /> Acesso a Ferramentas</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-purple-500" /> Google Drive & Agenda</li>
                          <li className="flex gap-2 items-center"><Check size={14} className="text-purple-500" /> Modelo Gemini Pro (Raciocínio)</li>
                      </ul>
                  </div>
              </div>
          </div>
      );
  }

  // MODO EDIÇÃO / CRIAÇÃO DO WIZARD
  return (
    <div className="h-[calc(100vh-80px)] w-full overflow-y-auto custom-scrollbar px-6 pb-20">
        <div className="max-w-6xl mx-auto pt-6">
            <Button variant="ghost" onClick={() => { setIsCreating(false); setSelectedAgent(null); }} className="mb-4 text-zinc-500 hover:text-white pl-0 hover:bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Lista
            </Button>
            {renderBuilder()}
        </div>
    </div>
  );
}

const Check = ({size, className}: any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>;
