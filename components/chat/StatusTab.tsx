
'use client';

import React from 'react';
import { CircleDashed, Lock } from 'lucide-react';
import { useRealtimeStore } from '@/store/useRealtimeStore';

export function StatusTab() {
  const { instances } = useRealtimeStore();
  
  // Pega a primeira instância conectada
  const activeInstance = instances.find(i => i.status === 'connected');

  return (
    <div className="p-4 space-y-6 h-full animate-in fade-in flex flex-col items-center justify-center text-center">
        
        <div className="bg-zinc-900/50 p-8 rounded-full border border-zinc-800 mb-4 relative">
             <CircleDashed className="w-12 h-12 text-zinc-600 opacity-50" />
             <div className="absolute bottom-0 right-0 bg-zinc-950 p-1 rounded-full border border-zinc-800">
                <Lock className="w-4 h-4 text-zinc-500" />
             </div>
        </div>

        <div className="max-w-[200px]">
            <h3 className="text-sm font-bold text-zinc-300 mb-2">Status (Stories)</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
                A visualização e postagem de Status foi desativada nesta versão para garantir maior estabilidade e segurança da sua conexão.
            </p>
        </div>

        {activeInstance && (
            <div className="flex items-center gap-2 mt-4 opacity-50">
                <div className="w-6 h-6 rounded-full overflow-hidden border border-zinc-700">
                    {activeInstance.profile_pic_url ? (
                        <img src={activeInstance.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800" />
                    )}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                    Conectado como {activeInstance.name}
                </span>
            </div>
        )}
    </div>
  );
}
