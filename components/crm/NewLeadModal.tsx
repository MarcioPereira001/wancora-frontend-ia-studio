'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagSelector } from './TagSelector';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Save, Flame, Sun, Snowflake } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultStageId?: string;
}

export function NewLeadModal({ isOpen, onClose, onSuccess, defaultStageId }: NewLeadModalProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    value_potential: 0,
    temperature: 'warm' as 'hot' | 'warm' | 'cold',
    notes: '',
    tags: [] as string[]
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      addToast({ type: 'warning', title: 'Atenção', message: 'Nome e Telefone são obrigatórios.' });
      return;
    }

    if (!defaultStageId) {
        addToast({ type: 'error', title: 'Erro', message: 'Nenhum estágio de funil definido.' });
        return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('leads').insert({
        company_id: user?.company_id,
        stage_id: defaultStageId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        value_potential: formData.value_potential,
        temperature: formData.temperature,
        notes: formData.notes,
        tags: formData.tags,
        lead_score: 0
      });

      if (error) throw error;

      addToast({ type: 'success', title: 'Sucesso', message: 'Lead criado com sucesso!' });
      setFormData({
        name: '', phone: '', email: '', value_potential: 0, temperature: 'warm', notes: '', tags: []
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      addToast({ type: 'error', title: 'Erro', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Lead"
      footer={
        <div className="flex gap-2 w-full justify-end">
            <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSubmit} isLoading={loading}>
                <Save className="w-4 h-4 mr-2" /> Salvar Lead
            </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Nome Completo *</label>
            <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ex: João Silva"
                className="mt-1"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">WhatsApp *</label>
                <Input 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="5511999999999"
                    className="mt-1"
                />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Valor (R$)</label>
                <Input 
                    type="number"
                    value={formData.value_potential} 
                    onChange={e => setFormData({...formData, value_potential: Number(e.target.value)})} 
                    className="mt-1"
                />
            </div>
        </div>

        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
            <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="cliente@email.com"
                className="mt-1"
            />
        </div>

        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Temperatura</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, temperature: 'hot'})}
                  className={`p-2 rounded border flex items-center justify-center gap-2 text-sm transition-colors ${formData.temperature === 'hot' ? 'bg-red-500/20 border-red-500 text-red-500' : 'border-zinc-700 text-zinc-500 hover:bg-zinc-800'}`}
                >
                    <Flame className="w-4 h-4" /> Quente
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, temperature: 'warm'})}
                  className={`p-2 rounded border flex items-center justify-center gap-2 text-sm transition-colors ${formData.temperature === 'warm' ? 'bg-orange-500/20 border-orange-500 text-orange-500' : 'border-zinc-700 text-zinc-500 hover:bg-zinc-800'}`}
                >
                    <Sun className="w-4 h-4" /> Morno
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, temperature: 'cold'})}
                  className={`p-2 rounded border flex items-center justify-center gap-2 text-sm transition-colors ${formData.temperature === 'cold' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'border-zinc-700 text-zinc-500 hover:bg-zinc-800'}`}
                >
                    <Snowflake className="w-4 h-4" /> Frio
                </button>
            </div>
        </div>

        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tags</label>
            <TagSelector 
                tags={formData.tags} 
                onChange={tags => setFormData({...formData, tags})} 
            />
        </div>

        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase">Observações</label>
            <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                placeholder="Detalhes sobre a negociação..."
                className="mt-1 h-20 resize-none"
            />
        </div>
      </div>
    </Modal>
  );
}