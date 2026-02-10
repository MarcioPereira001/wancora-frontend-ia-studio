
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldAlert, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MaintenanceGuard() {
    const { user } = useAuthStore();
    const supabase = createClient();
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [bypass, setBypass] = useState(false);

    useEffect(() => {
        // Busca estado inicial
        const checkStatus = async () => {
            const { data } = await supabase.from('system_config').select('maintenance_mode').single();
            if (data) setIsMaintenance(data.maintenance_mode);
        };
        checkStatus();

        // Escuta mudanças em tempo real
        const channel = supabase.channel('system_global')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'system_config' 
            }, (payload) => {
                setIsMaintenance(payload.new.maintenance_mode);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Se não estiver em manutenção, não renderiza nada
    if (!isMaintenance) return null;

    // Se for Super Admin, mostra aviso mas permite uso (Bypass)
    if (user?.super_admin) {
        if (bypass) return (
            <div className="fixed bottom-4 right-4 z-[99999] bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse flex items-center gap-2">
                <Lock className="w-3 h-3" /> MODO MANUTENÇÃO ATIVO
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[99999] bg-[#050000] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-red-900/10 rounded-full flex items-center justify-center border border-red-900/30 mb-8 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Sistema em Manutenção</h1>
            <p className="text-zinc-400 max-w-md text-sm leading-relaxed mb-8">
                Estamos realizando melhorias críticas na infraestrutura. O sistema voltará em breve. 
                Seus dados estão seguros.
            </p>

            {user?.super_admin ? (
                <Button 
                    onClick={() => setBypass(true)} 
                    variant="outline" 
                    className="border-red-900/50 text-red-400 hover:bg-red-950/50"
                >
                    Acessar como Super Admin
                </Button>
            ) : (
                <Button 
                    onClick={() => window.location.reload()} 
                    variant="ghost" 
                    className="text-zinc-500 hover:text-white"
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Tentar Reconectar
                </Button>
            )}
        </div>
    );
}
