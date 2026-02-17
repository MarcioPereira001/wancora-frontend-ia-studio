
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateAgentPromptAction } from '@/app/actions/gemini';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface PromptGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (prompt: string) => void;
}

export function PromptGeneratorModal({ isOpen, onClose, onGenerated }: PromptGeneratorModalProps) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        companyName: '',
        product: '',
        audience: '',
        tone: '',
        extra: ''
    });

    const handleGenerate = async () => {
        if(!formData.companyName || !formData.product) {
            addToast({ type: 'warning', title: 'Dados faltando', message: 'Preencha pelo menos Nome e O que vende.' });
            return;
        }

        setLoading(true);
        try {
            const res = await generateAgentPromptAction(formData);
            if (res.text) {
                onGenerated(res.text);
                addToast({ type: 'success', title: 'Sucesso', message: 'Prompt gerado com IA!' });
                onClose();
            } else {
                throw new Error('Sem resposta da IA');
            }
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao gerar prompt.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assistente de Criação de Persona" maxWidth="md">
            <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-200">
                        Responda algumas perguntas e nossa IA vai escrever um prompt profissional e estruturado para o seu agente.
                    </p>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Nome da Empresa</label>
                    <Input 
                        value={formData.companyName} 
                        onChange={e => setFormData({...formData, companyName: e.target.value})} 
                        className="bg-zinc-950 border-zinc-800 mt-1"
                        placeholder="Ex: Wancora Tech"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">O que você vende / oferece?</label>
                    <Textarea 
                        value={formData.product} 
                        onChange={e => setFormData({...formData, product: e.target.value})} 
                        className="bg-zinc-950 border-zinc-800 mt-1 h-20"
                        placeholder="Ex: Planos de internet fibra óptica, consultoria financeira..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Público Alvo</label>
                        <Input 
                            value={formData.audience} 
                            onChange={e => setFormData({...formData, audience: e.target.value})} 
                            className="bg-zinc-950 border-zinc-800 mt-1"
                            placeholder="Ex: Pequenos empresários"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Tom de Voz</label>
                        <Input 
                            value={formData.tone} 
                            onChange={e => setFormData({...formData, tone: e.target.value})} 
                            className="bg-zinc-950 border-zinc-800 mt-1"
                            placeholder="Ex: Formal, Amigável, Energético"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Informações Extras (Opcional)</label>
                    <Input 
                        value={formData.extra} 
                        onChange={e => setFormData({...formData, extra: e.target.value})} 
                        className="bg-zinc-950 border-zinc-800 mt-1"
                        placeholder="Ex: Não damos descontos, atendimento só horário comercial..."
                    />
                </div>

                <div className="pt-2 flex justify-end">
                    <Button onClick={handleGenerate} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white w-full md:w-auto">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Prompt Mestre</>}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
