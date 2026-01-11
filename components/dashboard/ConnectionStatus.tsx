'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { WhatsAppInstance } from '@/types';

export function ConnectionStatus() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [status, setStatus] = useState<WhatsAppInstance['status']>('disconnected');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
        const { data } = await supabase
            .from('instances')
            .select('status')
            .eq('company_id', user.company_id)
            .maybeSingle();
        
        if (data) setStatus(data.status);
        setLoading(false);
    };
    fetchStatus();
    
    // Polling is better for this than realtime subscription for simple status
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return <div className="h-2 w-2 bg-zinc-700 rounded-full animate-pulse" />;

  return (
    <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border bg-zinc-900 border-zinc-800">
        {status === 'connected' ? (
            <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-500">WhatsApp Online</span>
            </>
        ) : (
            <>
                 <AlertCircle className="w-3 h-3 text-red-500" />
                 <span className="text-zinc-500">Desconectado</span>
            </>
        )}
    </div>
  );
}