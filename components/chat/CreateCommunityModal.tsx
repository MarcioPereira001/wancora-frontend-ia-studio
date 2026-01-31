
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { Globe, Loader2 } from 'lucide-react';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  companyId: string;
}

export function CreateCommunityModal({ isOpen, onClose, sessionId, companyId }: CreateCommunityModalProps) {
  const { addToast } = useToast();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
      if (!subject.trim()) return addToast({ type: 'warning', title: 'Atenção', message: 'Nome da comunidade é obrigatório.' });
      
      setLoading(true);
      try {
          await api.post('/management/community/create', {
              sessionId,
              companyId,
              subject,
              description
          });
          
          addToast({ type: 'success', title: 'Sucesso', message: 'Comunidade criada.' });
          onClose();
          setSubject('');
          setDescription('');
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message || 'Falha ao criar comunidade.' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Comunidade" maxWidth="sm">
        <div className="space-y-6">
            <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg text-xs text-orange-200">
                Comunidades organizam múltiplos grupos sob um único guarda-chuva. Você poderá adicionar grupos existentes após criar.
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome da Comunidade</label>
                <Input 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)} 
                    placeholder="Ex: Condomínio Viva Bem" 
                    className="bg-zinc-950 border-zinc-800"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Descrição</label>
                <Textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Regras e informações gerais..." 
                    className="bg-zinc-950 border-zinc-800 h-24 resize-none"
                />
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleCreate} disabled={loading} className="bg-orange-600 hover:bg-orange-500 text-white w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                    Criar Comunidade
                </Button>
            </div>
        </div>
    </Modal>
  );
}
