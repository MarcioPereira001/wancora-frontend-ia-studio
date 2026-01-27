
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { Megaphone, Loader2 } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  companyId: string;
}

export function CreateChannelModal({ isOpen, onClose, sessionId, companyId }: CreateChannelModalProps) {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
      if (!name.trim()) return addToast({ type: 'warning', title: 'Atenção', message: 'Nome é obrigatório.' });
      
      setLoading(true);
      try {
          await api.post('/management/channel/create', {
              sessionId,
              companyId,
              name,
              description
          });
          
          addToast({ type: 'success', title: 'Sucesso', message: 'Canal criado.' });
          onClose();
          setName('');
          setDescription('');
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message || 'Falha ao criar canal.' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Canal" maxWidth="sm">
        <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-200">
                Canais são ótimos para transmitir novidades para uma audiência ilimitada sem expor números de telefone.
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Canal</label>
                <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: Promoções da Loja" 
                    className="bg-zinc-950 border-zinc-800"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Descrição</label>
                <Textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Sobre o que é este canal?" 
                    className="bg-zinc-950 border-zinc-800 h-24 resize-none"
                />
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                    Criar Canal
                </Button>
            </div>
        </div>
    </Modal>
  );
}
