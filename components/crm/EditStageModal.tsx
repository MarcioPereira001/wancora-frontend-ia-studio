'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KanbanColumn } from '@/types';
import { useKanban } from '@/hooks/useKanban';
import { useToast } from '@/hooks/useToast';
import { Save } from 'lucide-react';

interface EditStageModalProps {
  stage: KanbanColumn | null;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#f97316', // Orange
    '#ef4444', // Red
    '#a855f7', // Purple
    '#22c55e', // Green
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#71717a'  // Zinc
];

export function EditStageModal({ stage, isOpen, onClose }: EditStageModalProps) {
  const { updateStage } = useKanban();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
      if(stage) {
          setName(stage.title);
          setColor(stage.color);
      }
  }, [stage]);

  const handleSave = async () => {
      if(!stage) return;
      setLoading(true);
      try {
          await updateStage({ id: stage.id, name, color });
          addToast({ type: 'success', title: 'Sucesso', message: 'Estágio atualizado.' });
          onClose();
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao atualizar.' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Etapa" maxWidth="sm">
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Nome da Etapa</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
            
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} isLoading={loading}>
                    <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
            </div>
        </div>
    </Modal>
  );
}