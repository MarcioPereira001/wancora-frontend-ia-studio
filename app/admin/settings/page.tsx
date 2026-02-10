
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Megaphone, Lock, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminSettingsPage() {
    const supabase = createClient();
    const { addToast } = useToast();
    
    const [config, setConfig] = useState({
        maintenance_mode: false,
        broadcast_active: false,
        broadcast_message: '',
        broadcast_level: 'info'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from('system_config').select('*').single();
            if (data) {
                setConfig({
                    maintenance_mode: data.maintenance_mode,
                    broadcast_active: data.broadcast_active,
                    broadcast_message: data.broadcast_message || '',
                    broadcast_level: data.broadcast_level || 'info'
                });
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // ID fixo singleton
            const { error } = await supabase.from('system_config').update(config).eq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            addToast({ type: 'success', title: 'Salvo', message: 'Configurações globais aplicadas.' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Configurações Globais</h1>
                <p className="text-zinc-400 text-sm mt-1">Controle de acesso e comunicação em massa.</p>
            </div>

            {/* MAINTENANCE MODE */}
            <Card className="bg-red-950/10 border-red-900/30">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-900/20 rounded-full text-red-500 border border-red-900/50">
                                <Lock className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-white">Modo Manutenção (Kill Switch)</CardTitle>
                                <CardDescription className="text-red-400/70">
                                    Bloqueia o acesso de TODOS os usuários (exceto Admins). Use com cuidado.
                                </CardDescription>
                            </div>
                        </div>
                        <div 
                            onClick={() => setConfig({...config, maintenance_mode: !config.maintenance_mode})}
                            className={cn("w-14 h-7 rounded-full cursor-pointer transition-colors relative border", config.maintenance_mode ? "bg-red-600 border-red-500" : "bg-zinc-800 border-zinc-700")}
                        >
                            <div className={cn("w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md", config.maintenance_mode ? "left-8" : "left-1")} />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* BROADCAST */}
            <Card className="bg-zinc-900/40 border-zinc-800">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-900/20 rounded-full text-blue-500 border border-blue-900/50">
                                <Megaphone className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-white">Broadcast Global</CardTitle>
                                <CardDescription>
                                    Exibe uma faixa de aviso no topo da tela de todos os usuários logados.
                                </CardDescription>
                            </div>
                        </div>
                        <div 
                            onClick={() => setConfig({...config, broadcast_active: !config.broadcast_active})}
                            className={cn("w-14 h-7 rounded-full cursor-pointer transition-colors relative border", config.broadcast_active ? "bg-green-600 border-green-500" : "bg-zinc-800 border-zinc-700")}
                        >
                            <div className={cn("w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md", config.broadcast_active ? "left-8" : "left-1")} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Mensagem</label>
                        <Input 
                            value={config.broadcast_message} 
                            onChange={e => setConfig({...config, broadcast_message: e.target.value})}
                            placeholder="Ex: Sistema instável, manutenção em 10min..." 
                            className="bg-zinc-950 border-zinc-800"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Nível de Alerta</label>
                        <div className="flex gap-2">
                            {['info', 'warning', 'error'].map(level => (
                                <button
                                    key={level}
                                    onClick={() => setConfig({...config, broadcast_level: level})}
                                    className={cn(
                                        "flex-1 py-2 text-xs font-bold rounded border capitalize transition-all",
                                        config.broadcast_level === level
                                            ? (level === 'error' ? "bg-red-600 text-white border-red-500" : level === 'warning' ? "bg-orange-500 text-white border-orange-400" : "bg-blue-600 text-white border-blue-500")
                                            : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                                    )}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end pt-4 border-t border-zinc-800">
                <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-zinc-200 w-40 font-bold">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Aplicar Mudanças
                </Button>
            </div>
        </div>
    );
}
