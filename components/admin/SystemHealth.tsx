
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { api } from '@/services/api';
import { Activity, Database, Server, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SystemHealth() {
    const supabase = createClient();
    const [dbLatency, setDbLatency] = useState<number | null>(null);
    const [apiLatency, setApiLatency] = useState<number | null>(null);
    const [lastCheck, setLastCheck] = useState<Date>(new Date());

    const checkHealth = async () => {
        // 1. DB Latency Check
        const startDb = performance.now();
        await supabase.from('system_config').select('id').single();
        const endDb = performance.now();
        setDbLatency(Math.round(endDb - startDb));

        // 2. API Latency Check
        try {
            const startApi = performance.now();
            await api.get('/health');
            const endApi = performance.now();
            setApiLatency(Math.round(endApi - startApi));
        } catch (e) {
            setApiLatency(-1); // Erro
        }
        
        setLastCheck(new Date());
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (ms: number | null) => {
        if (ms === null) return 'text-zinc-500';
        if (ms === -1) return 'text-red-500';
        if (ms < 100) return 'text-emerald-500';
        if (ms < 500) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-purple-500" />
                    <span className="text-xs font-bold text-zinc-400">DB LATENCY</span>
                </div>
                <span className={cn("font-mono text-sm font-bold", getStatusColor(dbLatency))}>
                    {dbLatency !== null ? `${dbLatency}ms` : '...'}
                </span>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-bold text-zinc-400">API LATENCY</span>
                </div>
                <span className={cn("font-mono text-sm font-bold", getStatusColor(apiLatency))}>
                    {apiLatency !== null ? (apiLatency === -1 ? 'OFFLINE' : `${apiLatency}ms`) : '...'}
                </span>
            </div>
            
            <div className="col-span-2 text-[10px] text-zinc-600 text-right flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" /> Atualizado: {lastCheck.toLocaleTimeString()}
            </div>
        </div>
    );
}
