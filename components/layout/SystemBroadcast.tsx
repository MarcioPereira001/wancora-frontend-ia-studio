
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, Info, X, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SystemBroadcast() {
    const supabase = createClient();
    const [msg, setMsg] = useState<string | null>(null);
    const [level, setLevel] = useState<'info'|'warning'|'error'>('info');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase.from('system_config').select('*').single();
            if (data?.broadcast_active && data?.broadcast_message) {
                setMsg(data.broadcast_message);
                setLevel(data.broadcast_level || 'info');
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };
        fetchConfig();

        const channel = supabase.channel('broadcast_global')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_config' }, (payload) => {
                const data = payload.new;
                if (data.broadcast_active && data.broadcast_message) {
                    setMsg(data.broadcast_message);
                    setLevel(data.broadcast_level);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    if (!isVisible || !msg) return null;

    const styles = {
        info: 'bg-blue-600 text-white',
        warning: 'bg-orange-500 text-white',
        error: 'bg-red-600 text-white'
    };

    return (
        <div className={cn("w-full px-4 py-2 flex items-center justify-center relative text-xs font-medium animate-in slide-in-from-top-2", styles[level])}>
            <div className="flex items-center gap-2">
                {level === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                <span>{msg}</span>
            </div>
            <button 
                onClick={() => setIsVisible(false)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
