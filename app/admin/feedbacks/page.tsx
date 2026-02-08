
'use client';

import React, { useEffect, useState } from 'react';
import { getAdminFeedbacks, resolveFeedback } from '../actions';
import { 
    MessageSquare, Bug, Lightbulb, CheckCircle2, Search, Loader2 
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AdminFeedbacksPage() {
    const { addToast } = useToast();
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getAdminFeedbacks();
            setFeedbacks(data || []);
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar feedbacks.' });
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await resolveFeedback(id);
            addToast({ type: 'success', title: 'Resolvido', message: 'Status atualizado.' });
            loadData();
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao resolver.' });
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-blue-500" />
                        Feedbacks & Bugs
                    </h1>
                    <p className="text-zinc-400 mt-1 text-sm">Central de sugestões dos usuários.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {feedbacks.map(fb => (
                        <div key={fb.id} className={cn(
                            "p-4 rounded-xl border flex flex-col gap-3 relative overflow-hidden",
                            fb.status === 'resolved' ? "bg-zinc-900/30 border-zinc-800 opacity-60" : "bg-zinc-900/60 border-zinc-700"
                        )}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    {fb.type === 'bug' ? (
                                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold uppercase border border-red-500/30 flex items-center gap-1">
                                            <Bug className="w-3 h-3" /> Bug
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase border border-blue-500/30 flex items-center gap-1">
                                            <Lightbulb className="w-3 h-3" /> Sugestão
                                        </span>
                                    )}
                                    <span className="text-[10px] text-zinc-500">
                                        {format(new Date(fb.created_at), 'dd/MM/yy HH:mm')}
                                    </span>
                                </div>
                                {fb.status !== 'resolved' && (
                                    <button 
                                        onClick={() => handleResolve(fb.id)}
                                        className="text-zinc-500 hover:text-green-500 transition-colors"
                                        title="Marcar como Resolvido"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                                {fb.content}
                            </p>

                            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-1">
                                <div className="text-xs font-bold text-zinc-400">
                                    {fb.profiles?.name || 'Anônimo'} 
                                    <span className="font-normal text-zinc-600 ml-1">({fb.profiles?.email})</span>
                                </div>
                                <div className="text-[10px] text-zinc-600 font-mono">
                                    {fb.companies?.name || 'Sem Empresa'}
                                </div>
                            </div>
                            
                            {fb.status === 'resolved' && (
                                <div className="absolute inset-0 bg-zinc-950/50 flex items-center justify-center pointer-events-none">
                                    <span className="px-3 py-1 bg-green-900/80 text-green-200 rounded border border-green-800 text-xs font-bold">RESOLVIDO</span>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {feedbacks.length === 0 && (
                        <div className="col-span-full text-center py-20 text-zinc-500">
                            Nenhum feedback recebido.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
