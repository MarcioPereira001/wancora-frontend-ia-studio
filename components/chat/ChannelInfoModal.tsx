
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ChatContact } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { Megaphone, Save, Trash2, Camera, Loader2 } from 'lucide-react';
import { uploadChatMedia } from '@/utils/supabase/storage';

interface ChannelInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ChatContact;
  sessionId: string;
}

export function ChannelInfoModal({ isOpen, onClose, contact, sessionId }: ChannelInfoModalProps) {
  const { addToast } = useToast();
  const [name, setName] = useState(contact.name || '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Não há endpoint de update de metadata de canal no backend atual (apenas create/delete)
  // Então focaremos no Delete e na exibição. Se o backend suportar update no futuro, é só descomentar.

  const handleDelete = async () => {
      if(!confirm("Tem certeza que deseja apagar este canal? Ação irreversível.")) return;
      setLoading(true);
      try {
          await api.post('/management/channel/delete', {
              sessionId,
              channelId: contact.remote_jid
          });
          addToast({ type: 'success', title: 'Apagado', message: 'Canal removido.' });
          onClose();
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestão do Canal" maxWidth="md">
        <div className="space-y-6">
            <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mb-4 overflow-hidden relative group">
                    {contact.profile_pic_url ? (
                        <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        <Megaphone className="w-10 h-10 text-blue-400" />
                    )}
                </div>
                <h3 className="text-xl font-bold text-white">{contact.name}</h3>
                <p className="text-sm text-zinc-500">Canal de Transmissão</p>
            </div>

            <div className="space-y-4">
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Canal</label>
                    <div className="flex gap-2">
                        <Input value={name} onChange={e => setName(e.target.value)} className="bg-zinc-950 border-zinc-800" disabled />
                        <Button size="icon" disabled title="Edição em breve"><Save className="w-4 h-4" /></Button>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">*Edição de metadados de canal em breve.</p>
                </div>

                <Button 
                    variant="destructive" 
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                    onClick={handleDelete}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Apagar Canal
                </Button>
            </div>
        </div>
    </Modal>
  );
}
