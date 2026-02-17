
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { simulateChatAction } from '@/app/actions/gemini';
import { Bot, User, Send, Trash2, Loader2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentSimulatorProps {
    isOpen: boolean;
    onClose: () => void;
    systemPrompt: string;
    agentName: string;
    contextFiles?: string[]; // Nomes dos arquivos para simular contexto
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

export function AgentSimulator({ isOpen, onClose, systemPrompt, agentName, contextFiles = [] }: AgentSimulatorProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        const userMsg = input;
        setInput('');
        const newHistory = [...messages, { role: 'user' as const, text: userMsg }];
        setMessages(newHistory);
        setLoading(true);

        try {
            // Formata histórico para o Gemini
            const historyPayload = newHistory.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            // Simula conhecimento básico dos arquivos (apenas nomes por enquanto no simulador leve)
            const knowledgeBase = contextFiles.length > 0 
                ? `O agente tem acesso aos seguintes arquivos (simulado): ${contextFiles.join(', ')}.` 
                : "Sem arquivos anexados.";

            const res = await simulateChatAction(historyPayload, systemPrompt, knowledgeBase);
            
            if (res.text) {
                setMessages(prev => [...prev, { role: 'model', text: res.text || '' }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: '[Erro na simulação. Verifique sua API Key ou conexão.]' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Simulador: ${agentName}`} maxWidth="md">
            <div className="flex flex-col h-[500px]">
                {/* Chat Area */}
                <div className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 overflow-y-auto custom-scrollbar space-y-4 mb-4" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
                            <Bot className="w-12 h-12 mb-2" />
                            <p className="text-sm">Inicie a conversa para testar...</p>
                        </div>
                    )}
                    
                    {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shrink-0">
                                    <Bot className="w-4 h-4 text-purple-400" />
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[80%] p-3 rounded-xl text-sm leading-relaxed",
                                msg.role === 'user' 
                                    ? "bg-blue-600 text-white rounded-tr-none" 
                                    : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700"
                            )}>
                                {msg.text}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                                    <User className="w-4 h-4 text-zinc-400" />
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="flex gap-3 justify-start">
                             <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shrink-0">
                                <Bot className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl rounded-tl-none flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                                <span className="text-xs text-zinc-500">Digitando...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setMessages([])} title="Limpar Chat" className="text-zinc-500 hover:text-red-500 hover:bg-zinc-900 border border-zinc-800">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    <Input 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite sua mensagem de teste..."
                        className="flex-1 bg-zinc-950 border-zinc-800"
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-500">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
