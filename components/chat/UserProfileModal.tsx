
'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { User, ShieldCheck, Smartphone, Battery } from 'lucide-react';
import { useRealtimeStore } from '@/store/useRealtimeStore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function UserProfileModal({ isOpen, onClose, sessionId }: UserProfileModalProps) {
  const { instances } = useRealtimeStore();
  
  // Encontra instância atual
  const currentInstance = instances.find(i => i.session_id === sessionId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minha Conexão" maxWidth="sm">
        <div className="flex flex-col items-center space-y-6 py-6">
            
            {/* Foto (Read Only) */}
            <div className="relative group w-24 h-24">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-green-500/20 overflow-hidden shadow-2xl">
                    {currentInstance?.profile_pic_url ? (
                        <img src={currentInstance.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><User className="w-8 h-8 text-zinc-500" /></div>
                    )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-zinc-950 p-1.5 rounded-full border border-zinc-800 shadow-md">
                     <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
            </div>

            {/* Info Atual */}
            <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">{currentInstance?.name || 'WhatsApp Conectado'}</h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                        {sessionId}
                    </span>
                    {currentInstance?.battery_level !== undefined && (
                        <span className="text-xs text-zinc-400 flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                            <Battery className="w-3 h-3" /> {currentInstance.battery_level}%
                        </span>
                    )}
                </div>
            </div>

            {/* Aviso de Segurança */}
            <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start text-left w-full">
                <Smartphone className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-blue-200">Gerenciado no Dispositivo</h4>
                    <p className="text-xs text-blue-200/60 mt-1 leading-relaxed">
                        Para alterar sua foto de perfil, nome ou recado, utilize o aplicativo oficial do WhatsApp no seu celular. O CRM reflete essas mudanças automaticamente.
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
