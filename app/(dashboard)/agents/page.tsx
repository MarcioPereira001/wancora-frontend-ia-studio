'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Save, Play, Zap, Loader2, Send, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { optimizePromptAction, simulateChatAction } from '@/app/actions/gemini';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/useAuthStore';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function AgentsPage() {
  const { addToast } = useToast();
  const { user } = useAuthStore(); // Usando store para garantir company_id
  const [prompt, setPrompt] = useState("Você é um assistente de suporte útil para o Wancora CRM. Seja educado e conciso.");
  const [agentName, setAgentName] = useState("Agente Principal");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [isActive, setIsActive] = useState(false);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simMessages, setSimMessages] = useState<ChatMessage[]>([]);
  const [simInput, setSimInput] = useState("");
  const [isSimLoading, setIsSimLoading] = useState(false);
  const simEndRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    if (!user?.company_id) return;

    const loadAgent = async () => {
        try {
            const { data } = await supabase
                .from('agents')
                .select('*')
                .eq('company_id', user.company_id) // Filtro explícito de segurança
                .limit(1)
                .maybeSingle();
            
            if (data) {
                setPrompt(data.prompt_instruction || "");
                setAgentName(data.name);
                setKnowledgeBase(data.knowledge_base || "");
                setIsActive(data.is_active);
            }
        } catch (e) {
            console.log("Nenhum agente configurado, usando padrões.");
        } finally {
            setIsLoading(false);
        }
    };
    loadAgent();
  }, [supabase, user?.company_id]);

  useEffect(() => {
      if(isSimulatorOpen) {
          simEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [simMessages, isSimulatorOpen]);

  const handleSave = async () => {
    if (!user?.company_id) {
        addToast({ type: 'error', title: 'Erro', message: 'Sessão inválida. Recarregue a página.' });
        return;
    }

    setIsSaving(true);
    try {
        // Verifica existência usando company_id
        const { data: existingAgent } = await supabase
            .from('agents')
            .select('id')
            .eq('company_id', user.company_id)
            .limit(1)
            .maybeSingle();

        let error;
        if (existingAgent) {
             const { error: updError } = await supabase
                .from('agents')
                .update({ 
                    name: agentName,
                    prompt_instruction: prompt,
                    knowledge_base: knowledgeBase,
                    is_active: isActive
                })
                .eq('id', existingAgent.id);
             error = updError;
        } else {
             const { error: insError } = await supabase
                .from('agents')
                .insert({ 
                    name: agentName,
                    prompt_instruction: prompt,
                    knowledge_base: knowledgeBase,
                    is_active: isActive,
                    company_id: user.company_id 
                });
             error = insError;
        }

        if (error) throw error;
        addToast({
            type: 'success',
            title: 'Agente salvo!',
            message: 'As configurações de IA foram atualizadas com sucesso.'
        });
    } catch (e: any) {
        addToast({ type: 'error', title: 'Erro ao salvar', message: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
        const result = await optimizePromptAction(prompt);
        if (result.error) throw new Error(result.error);
        
        setPrompt(result.text || prompt);
        addToast({ type: 'success', title: 'Prompt Otimizado', message: 'A IA melhorou sua instrução.' });
    } catch (e) {
        addToast({ type: 'error', title: 'Erro na Otimização', message: 'Falha na conexão com o servidor de IA.' });
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleSimulateSend = async () => {
      if(!simInput.trim()) return;
      
      const userMsg: ChatMessage = { role: 'user', text: simInput };
      const newHistory = [...simMessages, userMsg];
      
      setSimMessages(newHistory);
      setSimInput("");
      setIsSimLoading(true);

      try {
          const apiHistory = newHistory.map(m => ({
              role: m.role,
              parts: [{ text: m.text }]
          }));

          const result = await simulateChatAction(apiHistory, prompt, knowledgeBase);
          setSimMessages(prev => [...prev, { role: 'model', text: result.text || "Erro..." }]);
      } catch (error) {
          setSimMessages(prev => [...prev, { role: 'model', text: "Erro ao conectar com o cérebro do agente." }]);
      } finally {
          setIsSimLoading(false);
      }
  };

  const resetSimulator = () => {
      setSimMessages([{ role: 'model', text: `Olá! Eu sou ${agentName}. Como posso ajudar você hoje?` }]);
  };

  if (isLoading) {
      return (
          <div className="flex justify-center items-center h-full">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
          </div>
      )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" />
            Configuração de Agentes IA
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Configure seus agentes autônomos (Tabela: agents).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-32 h-32 text-primary" />
                </div>
                
                <div className="space-y-4 relative z-10">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Nome do Agente</label>
                        <input 
                            type="text" 
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-zinc-300">Instrução do Sistema (Prompt)</label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleOptimize}
                                isLoading={isOptimizing}
                                className="text-xs text-secondary hover:text-secondary h-6"
                            >
                                <Sparkles className="w-3 h-3 mr-1" />
                                Otimizar com IA
                            </Button>
                        </div>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 focus:ring-1 focus:ring-primary outline-none font-mono leading-relaxed resize-none transition-all custom-scrollbar"
                            placeholder="Ex: Você é um vendedor agressivo que vende seguros..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Base de Conhecimento (Contexto)</label>
                        <textarea 
                            value={knowledgeBase}
                            onChange={(e) => setKnowledgeBase(e.target.value)}
                            placeholder="Cole aqui informações sobre sua empresa, preços, links úteis..."
                            className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 focus:ring-1 focus:ring-primary outline-none font-mono leading-relaxed resize-none transition-all custom-scrollbar"
                        />
                        <p className="text-xs text-zinc-500 mt-2">
                            Informações que o agente usará para responder dúvidas específicas.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="outline">Descartar</Button>
                <Button variant="default" onClick={handleSave} isLoading={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configuração
                </Button>
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">Status & Modelo</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Modelo</label>
                        <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none" disabled>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-zinc-300">Agente Ativo</span>
                            <div 
                                className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ${isActive ? 'bg-primary' : 'bg-zinc-700'}`}
                                onClick={() => setIsActive(!isActive)}
                            >
                                <span className={`${isActive ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition`} />
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500">
                            {isActive ? 'O Agente responderá mensagens automaticamente.' : 'Automação pausada.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Play className="w-5 h-5 text-zinc-400" />
                </div>
                <h4 className="text-sm font-medium text-zinc-300">Testar Agente</h4>
                <p className="text-xs text-zinc-500 mt-1 mb-3">Simule interações antes de ativar.</p>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                        resetSimulator();
                        setIsSimulatorOpen(true);
                    }}
                >
                    Abrir Laboratório
                </Button>
            </div>
        </div>
      </div>

      <Modal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title={`Laboratório: ${agentName}`}
        maxWidth="lg"
      >
        <div className="flex flex-col h-[500px]">
            <div className="bg-zinc-950/50 rounded-lg p-3 mb-2 flex items-center justify-between border border-zinc-800/50">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span>Ambiente de Simulação</span>
                </div>
                <button onClick={resetSimulator} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Limpar Conversa
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar bg-zinc-950/30 rounded-lg border border-zinc-800/50 mb-4">
                {simMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                            msg.role === 'user' 
                            ? 'bg-primary/20 text-primary-foreground rounded-tr-sm border border-primary/20' 
                            : 'bg-zinc-800 text-zinc-100 rounded-tl-sm border border-zinc-700'
                        }`}>
                            {msg.role === 'model' && (
                                <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-1 font-bold uppercase">
                                    <Bot className="w-3 h-3" /> {agentName}
                                </div>
                            )}
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isSimLoading && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-2 border border-zinc-700 flex items-center gap-2">
                             <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                             <span className="text-xs text-zinc-400">Digitando...</span>
                        </div>
                    </div>
                )}
                <div ref={simEndRef} />
            </div>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimulateSend()}
                    placeholder="Digite uma mensagem para testar..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    autoFocus
                />
                <Button 
                    variant="default" 
                    size="icon" 
                    onClick={handleSimulateSend} 
                    isLoading={isSimLoading}
                    disabled={!simInput.trim() || isSimLoading}
                >
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
}