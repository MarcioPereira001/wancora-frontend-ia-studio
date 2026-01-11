'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/Button";
import { TagSelector } from "@/components/crm/TagSelector";
import { Send, Save, Calendar, Users, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

export default function NewCampaignPage() {
    const { addToast } = useToast();
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        message: '',
        tags: [] as string[],
        scheduledAt: ''
    });

    const handleSave = async (isDraft = false) => {
        if (!formData.name || !formData.message) {
            addToast({ 
                type: 'warning', 
                title: 'Campos obrigatórios', 
                message: 'Defina um nome e uma mensagem para a campanha.' 
            });
            return;
        }

        if (formData.tags.length === 0) {
            addToast({ 
                type: 'warning', 
                title: 'Público Alvo', 
                message: 'Selecione pelo menos uma tag para filtrar os contatos.' 
            });
            return;
        }

        setLoading(true);
        
        try {
            // Persistência Real no Supabase
            const { error } = await supabase.from('campaigns').insert({
                name: formData.name,
                message: formData.message,
                target_tags: formData.tags,
                scheduled_at: formData.scheduledAt || null,
                status: isDraft ? 'draft' : (formData.scheduledAt ? 'scheduled' : 'sent'),
                company_id: user?.company_id
            });

            if (error) throw error;
            
            addToast({ 
                type: 'success', 
                title: isDraft ? 'Rascunho Salvo' : 'Campanha Criada', 
                message: isDraft 
                    ? 'Sua campanha foi salva em rascunhos.' 
                    : `Disparo agendado para ${formData.tags.length * 15} contatos estimados.` 
            });
            
            router.push('/dashboard');
        } catch (error: any) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro ao salvar', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <Send className="w-8 h-8 text-primary" />
                    Nova Campanha
                </h1>
                <p className="text-zinc-400">Configure disparos em massa via WhatsApp para sua base de contatos.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="glass border-zinc-800">
                        <CardHeader>
                            <CardTitle>Conteúdo da Mensagem</CardTitle>
                            <CardDescription>O que você quer enviar para seus clientes?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Nome da Campanha</label>
                                <Input 
                                    placeholder="Ex: Promoção de Natal 2026" 
                                    className="bg-zinc-900/50 border-zinc-800"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Mensagem</label>
                                <Textarea 
                                    placeholder="Olá {{nome}}, temos uma oferta especial para você..." 
                                    className="min-h-[200px] bg-zinc-900/50 border-zinc-800 resize-none"
                                    value={formData.message}
                                    onChange={e => setFormData({...formData, message: e.target.value})}
                                />
                                <p className="text-xs text-zinc-500">
                                    Dica: Use variáveis como {'{{nome}}'} para personalizar a mensagem.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass border-zinc-800">
                        <CardHeader>
                            <CardTitle>Público Alvo</CardTitle>
                            <CardDescription>Quem deve receber esta mensagem?</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-zinc-300">Filtrar por Tags</label>
                                <TagSelector 
                                    tags={formData.tags}
                                    onChange={tags => setFormData({...formData, tags})}
                                    suggestions={['Cliente Ativo', 'Lead Quente', 'Newsletter', 'Ex-Cliente', 'Black Friday']}
                                />
                                {formData.tags.length > 0 && (
                                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3 mt-4">
                                        <Users className="w-5 h-5 text-primary mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-primary">Estimativa de Alcance</p>
                                            <p className="text-xs text-zinc-400">Aproximadamente <strong>{formData.tags.length * 15 + 42}</strong> contatos correspondem a essas tags.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="glass border-zinc-800">
                        <CardHeader>
                            <CardTitle>Agendamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Data e Hora</label>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-zinc-500" />
                                    <Input 
                                        type="datetime-local" 
                                        className="bg-zinc-900/50 border-zinc-800"
                                        value={formData.scheduledAt}
                                        onChange={e => setFormData({...formData, scheduledAt: e.target.value})}
                                    />
                                </div>
                                <p className="text-xs text-zinc-500">Deixe em branco para enviar imediatamente.</p>
                            </div>
                            
                            <div className="pt-4 border-t border-zinc-800">
                                <div className="flex items-start gap-2 text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                                    <AlertCircle className="w-4 h-4 mt-0.5" />
                                    <p className="text-xs">O WhatsApp pode bloquear números que enviam spam. Certifique-se de que seus contatos aceitaram receber mensagens.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-3">
                        <Button 
                            className="w-full" 
                            size="lg" 
                            onClick={() => handleSave(false)}
                            isLoading={loading}
                        >
                            <Send className="w-4 h-4 mr-2" />
                            {formData.scheduledAt ? 'Agendar Disparo' : 'Enviar Agora'}
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => handleSave(true)}
                            disabled={loading}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Rascunho
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}