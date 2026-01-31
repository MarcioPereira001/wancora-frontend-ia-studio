
'use client';

import React from 'react';
import { CircleDashed, Plus, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { uploadChatMedia } from '@/utils/supabase/storage';

export function StatusTab() {
  const { user } = useAuthStore();
  const { instances } = useRealtimeStore();
  const { addToast } = useToast();
  
  // Pega a primeira instância conectada
  const activeInstance = instances.find(i => i.status === 'connected');

  const handlePostStatus = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id || !activeInstance) return;

      try {
          addToast({ type: 'info', title: 'Enviando', message: 'Publicando status...' });
          const { publicUrl } = await uploadChatMedia(file, user.company_id);
          
          await api.post('/management/status/post', {
              sessionId: activeInstance.session_id,
              type: file.type.startsWith('video') ? 'video' : 'image',
              content: publicUrl,
              options: { caption: '' }
          });
          
          addToast({ type: 'success', title: 'Publicado', message: 'Status enviado com sucesso.' });
      } catch (err: any) {
          addToast({ type: 'error', title: 'Erro', message: err.message });
      }
  };

  return (
    <div className="p-4 space-y-6 h-full animate-in fade-in">
        {/* Meu Status */}
        <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-700 p-0.5 group-hover:border-primary transition-colors">
                    {activeInstance?.profile_pic_url ? (
                        <img src={activeInstance.profile_pic_url} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center">
                            <CircleDashed className="w-6 h-6 text-zinc-500" />
                        </div>
                    )}
                </div>
                <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-0.5 cursor-pointer shadow-lg hover:scale-110 transition-transform">
                    <Plus className="w-3.5 h-3.5" />
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={handlePostStatus} disabled={!activeInstance} />
                </label>
            </div>
            <div>
                <h4 className="font-bold text-white text-sm">Meu Status</h4>
                <p className="text-xs text-zinc-500">Toque para atualizar</p>
            </div>
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Lista de Status (Placeholder / Mock Visual) */}
        <div>
            <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Atualizações Recentes</h5>
            
            <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-600 gap-2">
                <CircleDashed className="w-8 h-8 opacity-50" />
                <p className="text-xs">Nenhum status recente dos seus contatos.</p>
            </div>
            
            {/* Exemplo Visual de como seria um item */}
            {/* 
            <div className="flex items-center gap-3 py-2 cursor-pointer hover:bg-zinc-800/50 rounded-lg px-2 -mx-2 transition-colors">
                <div className="w-10 h-10 rounded-full border-2 border-green-500 p-0.5">
                    <img src="https://github.com/shadcn.png" className="w-full h-full rounded-full" />
                </div>
                <div>
                    <h4 className="font-bold text-zinc-200 text-sm">João Silva</h4>
                    <p className="text-xs text-zinc-500">Há 15 minutos</p>
                </div>
            </div> 
            */}
        </div>
        
        {!activeInstance && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs text-red-300 text-center">
                Conecte o WhatsApp para ver e postar status.
            </div>
        )}
    </div>
  );
}
