'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SystemLog } from '@/types';
import { 
    AlertOctagon, AlertTriangle, Info, Terminal, 
    Search, Filter, PauseCircle, PlayCircle, Trash2, ChevronDown, ChevronRight,
    Globe, Database, Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function LogViewer() {
    const supabase = createClient();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    
    // Set para múltiplos logs abertos
    const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
    
    // Filtros
    const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const logsRef = useRef<SystemLog[]>([]); 

    useEffect(() => {
        fetchLogs();

        const channel = supabase.channel('admin-logs-monitor')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'system_logs' 
            }, (payload) => {
                if (isPaused) return; 

                const newLog = payload.new as SystemLog;
                
                setLogs(prev => {
                    const updated = [newLog, ...prev].slice(0, 200); 
                    logsRef.current = updated;
                    return updated;
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isPaused]); 

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
        setLogs([]);
        await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    };

    const toggleLog = (id: string) => {
        const newSet = new Set(expandedLogIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedLogIds(newSet);
    };

    const filteredLogs = logs.filter(log => {
        const matchesLevel = filterLevel === 'all' || 
            (filterLevel === 'error' && (log.level === 'error' || log.level === 'fatal')) ||
            log.level === filterLevel;
        
        const matchesSearch = !searchTerm || 
            log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
            JSON.stringify(log.metadata).toLowerCase().includes(searchTerm.toLowerCase());

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

    const getSourceIcon = (source: string) => {
        switch(source) {
            case 'frontend': return <Globe className="w-3 h-3 mr-1" />;
            case 'database': return <Database className="w-3 h-3 mr-1" />;
            case 'backend': return <Server className="w-3 h-3 mr-1" />;
            default: return <Terminal className="w-3 h-3 mr-1" />;
        }
    }

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
                            placeholder="Buscar logs (msg, json)..."
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
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-black/40 font-mono text-xs relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <div className="text-zinc-400">Carregando telemetria...</div>
                    </div>
                )}
                
                {filteredLogs.length === 0 && !loading && (
                    <div className="text-center py-20 text-zinc-600 italic">
                        Nenhum log encontrado.
                    </div>
                )}

                {filteredLogs.map(log => {
                    const isExpanded = expandedLogIds.has(log.id);
                    const style = getLevelColor(log.level);
                    
                    return (
                        <div key={log.id} className="group">
                            <div 
                                onClick={() => toggleLog(log.id)}
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

                                <div className="w-24 shrink-0 font-bold uppercase tracking-wider text-zinc-400 flex items-center">
                                    {getSourceIcon(log.source)} {log.source}
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
                                <div className="ml-11 mt-1 mb-2 p-4 bg-[#050505] rounded-lg border border-zinc-800 overflow-x-auto animate-in slide-in-from-top-1">
                                    <table className="w-full text-left text-zinc-400">
                                        <tbody>
                                            <tr className="border-b border-zinc-900">
                                                <td className="py-2 font-bold w-32 align-top">Mensagem</td>
                                                <td className="py-2 text-white break-words whitespace-pre-wrap">{log.message}</td>
                                            </tr>
                                            {/* Exibição Inteligente de Metadata */}
                                            {log.metadata && (
                                                <>
                                                 {/* Se for erro de Rede (API) */}
                                                 {(log.metadata.url || log.metadata.status) && (
                                                     <tr className="border-b border-zinc-900 bg-red-900/10">
                                                         <td className="py-2 font-bold text-red-400">Network Error</td>
                                                         <td className="py-2">
                                                             <div className="flex gap-4">
                                                                 <span className="font-bold text-red-300">{log.metadata.method || 'GET'}</span>
                                                                 <span className="text-zinc-300">{log.metadata.url}</span>
                                                                 <span className="font-bold text-red-500">{log.metadata.status}</span>
                                                             </div>
                                                             {log.metadata.body && (
                                                                 <div className="mt-2 text-zinc-400 bg-black p-2 rounded border border-zinc-800">
                                                                    <strong>Response Body:</strong><br/>
                                                                    {typeof log.metadata.body === 'string' ? log.metadata.body.substring(0, 500) : JSON.stringify(log.metadata.body)}
                                                                 </div>
                                                             )}
                                                         </td>
                                                     </tr>
                                                 )}

                                                 {/* Stack Trace */}
                                                 {(log.metadata.stack || log.metadata.componentStack) && (
                                                     <tr className="border-b border-zinc-900">
                                                         <td className="py-2 font-bold align-top text-yellow-500">Stack Trace</td>
                                                         <td className="py-2">
                                                             <pre className="text-[10px] text-yellow-200/70 overflow-x-auto whitespace-pre-wrap max-h-40 custom-scrollbar bg-zinc-900/50 p-2 rounded">
                                                                 {log.metadata.stack || log.metadata.componentStack}
                                                             </pre>
                                                         </td>
                                                     </tr>
                                                 )}

                                                 {/* Raw Metadata */}
                                                 <tr>
                                                     <td className="py-2 font-bold align-top">Raw Metadata</td>
                                                     <td className="py-2">
                                                         <pre className="text-[10px] text-green-400 overflow-auto max-h-60 custom-scrollbar">
                                                             {JSON.stringify(log.metadata, null, 2)}
                                                         </pre>
                                                     </td>
                                                 </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="mt-2 text-[10px] text-zinc-600 flex gap-4">
                                        <span>User ID: {log.user_id || 'N/A'}</span>
                                        <span>Company ID: {log.company_id || 'N/A'}</span>
                                        <span>ID Log: {log.id}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}