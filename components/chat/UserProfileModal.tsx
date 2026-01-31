
'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { User, ShieldAlert, Smartphone } from 'lucide-react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useAuthStore } from '@/store/useAuthStore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function UserProfileModal({ isOpen, onClose, sessionId }: UserProfileModalProps) {
  const { user } = useAuthStore();
  const { instances } = useRealtimeStore();
  
  // Encontra instância atual
  const currentInstance = instances.find(i => i.session_id === sessionId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil Conectado" maxWidth="sm">
        <div className="flex flex-col items-center space-y-6 py-4">
            
            {/* Foto (Read Only) */}
            <div className="relative group w-28 h-28">
                <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-green-500/30 overflow-hidden shadow-xl">
                    {currentInstance?.profile_pic_url ? (
                        <img src={currentInstance.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><User className="w-10 h-10 text-zinc-500" /></div>
                    )}
                </div>
            </div>

            {/* Info Atual */}
            <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-white">{currentInstance?.name || 'WhatsApp User'}</h3>
                <p className="text-sm text-zinc-500 font-mono bg-zinc-900 px-2 py-0.5 rounded-full inline-block border border-zinc-800">
                    {sessionId}
                </p>
            </div>

            {/* Aviso de Segurança */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start text-left w-full">
                <Smartphone className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-blue-200">Gerenciado pelo Celular</h4>
                    <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                        Para alterar sua foto, nome ou recado, utilize o aplicativo oficial do WhatsApp no seu celular.
                        As alterações serão sincronizadas automaticamente com o CRM.
                    </p>
                </div>
            </div>

            <div className="w-full pt-2">
                <Button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
                    Fechar
                </Button>
            </div>
        </div>
    </Modal>
  );
}
