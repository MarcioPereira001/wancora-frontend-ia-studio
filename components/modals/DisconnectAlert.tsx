
'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { AlertTriangle, Power, RefreshCw } from 'lucide-react';

export function DisconnectAlert() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDisconnectModalOpen, setDisconnectModalOpen } = useRealtimeStore();

  const handleReconnect = () => {
    setDisconnectModalOpen(false);
    // Se já estiver na página de conexões, apenas fecha o modal, senão navega
    if (pathname !== '/connections') {
        router.push('/connections');
    } else {
        // Se já está na página, talvez forçar um refresh da lista
        window.location.reload();
    }
  };

  return (
    <Modal 
        isOpen={isDisconnectModalOpen} 
        onClose={() => setDisconnectModalOpen(false)} 
        title="Conexão Interrompida"
        maxWidth="sm"
    >
        <div className="flex flex-col items-center text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 animate-pulse">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">WhatsApp Desconectado</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                    O servidor reiniciou (Deploy ou Atualização) e a conexão com o WhatsApp foi encerrada por segurança.
                </p>
                <p className="text-xs text-zinc-500 bg-zinc-900 p-2 rounded border border-zinc-800 mt-2">
                    Erro: Sessão não encontrada ou desconectada.
                </p>
            </div>

            <div className="w-full space-y-3">
                <Button 
                    onClick={handleReconnect} 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 shadow-lg shadow-green-500/20"
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Reconectar Agora
                </Button>
                
                <Button 
                    variant="ghost" 
                    onClick={() => setDisconnectModalOpen(false)}
                    className="w-full text-zinc-500 hover:text-white"
                >
                    Fechar e tentar depois
                </Button>
            </div>
        </div>
    </Modal>
  );
}
