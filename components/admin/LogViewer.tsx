
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SystemLog } from '@/types';
import { 
    AlertOctagon, AlertTriangle, Info, Terminal, 
    Search, Filter, PauseCircle, PlayCircle, Trash2, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function LogViewer() {
    const supabase = createClient();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    
    // Filtros
    const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Refs para controle de scroll e buffer
    const scrollRef = useRef<HTMLDivElement>(null);
    const logsRef = useRef<SystemLog[]>([]); // Ref para manter estado atual no callback do realtime

    // Carregamento Inicial
    useEffect(() => {
        fetchLogs();

        // Realtime Subscription
        const channel = supabase.channel('admin-logs-monitor')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'system_logs' 
            }, (payload) => {
                if (isPaused) return; // Se pausado, ignora novos (para leitura)

                const newLog = payload.new as SystemLog;
                
                // Adiciona ao topo
                setLogs(prev => {
                    const updated = [newLog, ...prev].slice(0, 200); // Mantém apenas os últimos 200 na memória
                    logsRef.current = updated;
                    return updated;
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isPaused]); // Re-bind se pause mudar? Não, controlamos no callback.

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (data) {
            setLogs(data as SystemLog[]);
            logsRef.current = data as SystemLog[];
        }
        setLoading(false);
    };

    const handleClearLogs = async () => {
        if (!confirm('Isso limpará os logs do banco de dados. Tem certeza?')) return;
        // Limpa visualmente primeiro
        setLogs([]);
        await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    };

    // Filtragem no Frontend (para performance de UI)
    const filteredLogs = logs.filter(log => {
        const matchesLevel = filterLevel === 'all' || 
            (filterLevel === 'error' && (log.level === 'error' || log.level === 'fatal')) ||
            log.level === filterLevel;
        
        const matchesSearch = !searchTerm || 
            log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.source.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesLevel && matchesSearch;
    });

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'fatal': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'error': return 'text-red-400 bg-red-500/5 border-red-500/10';
            case 'warn': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-blue-400 bg-blue-500/5 border-blue-500/10';
        }
    };

    const getIcon = (level: string) => {
        switch(level) {
            case 'fatal': return <AlertOctagon className="w-4 h-4" />;
            case 'error': return <AlertTriangle className="w-4 h-4" />;
            case 'warn': return <AlertTriangle className="w-4 h-4" />;
            default: return <Info className="w-4 h-4" />;
        }
    };

    return (
        <div className="bg-[#0f0f10] border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[600px] shadow-2xl">
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Terminal className="w-5 h-5" />
                        <span className="font-mono text-sm font-bold">system_logs</span>
                    </div>
                    
                    <div className="h-6 w-px bg-zinc-800" />

                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        {(['all', 'error', 'warn', 'info'] as const).map(lvl => (
                            <button
                                key={lvl}
                                onClick={() => setFilterLevel(lvl)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                                    filterLevel === lvl ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {lvl === 'error' ? 'Errors' : lvl}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-600" />
                        <Input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar logs..."
                            className="w-64 h-9 pl-9 bg-zinc-950 border-zinc-800 text-xs font-mono focus:border-zinc-700"
                        />
                    </div>

                    <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => setIsPaused(!isPaused)}
                        className={cn("h-9 w-9", isPaused ? "text-yellow-500" : "text-green-500")}
                        title={isPaused ? "Retomar Stream" : "Pausar Stream"}
                    >
                        {isPaused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                    </Button>
                    
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={handleClearLogs}
                        className="h-9 w-9 text-zinc-600 hover:text-red-500 hover:bg-red-500/10"
                        title="Limpar Logs"
                    >
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-black/40 font-mono text-xs relative" ref={scrollRef}>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <div className="text-zinc-400">Carregando telemetria...</div>
                    </div>
                )}
                
                {filteredLogs.length === 0 && !loading && (
                    <div className="text-center py-20 text-zinc-600 italic">
                        Nenhum log encontrado para os filtros atuais.
                    </div>
                )}

                {filteredLogs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    const style = getLevelColor(log.level);
                    
                    return (
                        <div key={log.id} className="group">
                            <div 
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded border border-transparent hover:bg-zinc-900 cursor-pointer transition-colors",
                                    isExpanded ? "bg-zinc-900 border-zinc-800" : ""
                                )}
                            >
                                <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 border", style)}>
                                    {getIcon(log.level)}
                                </div>
                                
                                <div className="w-32 shrink-0 text-zinc-500">
                                    {format(new Date(log.created_at), 'HH:mm:ss.SSS')}
                                </div>

                                <div className="w-24 shrink-0 font-bold uppercase tracking-wider text-zinc-400">
                                    [{log.source}]
                                </div>

                                <div className="flex-1 truncate text-zinc-300 group-hover:text-white">
                                    {log.message}
                                </div>

                                <div className="text-zinc-600 shrink-0">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                            </div>

                            {/* Detalhes Expandidos (JSON View) */}
                            {isExpanded && (
                                <div className="ml-11 mt-1 mb-2 p-4 bg-[#050505] rounded-lg border border-zinc-800 overflow-x-auto">
                                    <table className="w-full text-left text-zinc-400">
                                        <tbody>
                                            <tr className="border-b border-zinc-900">
                                                <td className="py-2 font-bold w-32">Timestamp</td>
                                                <td className="py-2 text-zinc-300">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}</td>
                                            </tr>
                                            <tr className="border-b border-zinc-900">
                                                <td className="py-2 font-bold">Company ID</td>
                                                <td className="py-2 text-zinc-300">{log.company_id || 'N/A'}</td>
                                            </tr>
                                            <tr className="border-b border-zinc-900">
                                                <td className="py-2 font-bold">User ID</td>
                                                <td className="py-2 text-zinc-300">{log.user_id || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 font-bold align-top">Metadata</td>
                                                <td className="py-2">
                                                    <pre className="text-[10px] text-green-400 overflow-auto max-h-60 custom-scrollbar">
                                                        {JSON.stringify(log.metadata, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
