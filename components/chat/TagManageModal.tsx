
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { TagSelector } from '@/components/crm/TagSelector';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Save } from 'lucide-react';

interface TagManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  initialTags: string[];
}

export function TagManageModal({ isOpen, onClose, leadId, initialTags }: TagManageModalProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
      setTags(initialTags || []);
  }, [initialTags, isOpen]);

  const handleSave = async () => {
      setLoading(true);
      try {
          const { error } = await supabase
              .from('leads')
              .update({ tags, updated_at: new Date().toISOString() })
              .eq('id', leadId);

          if (error) throw error;
          
          addToast({ type: 'success', title: 'Tags Atualizadas', message: 'Etiquetas salvas com sucesso.' });
          onClose();
          // O Realtime atualizará a lista
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Etiquetas" maxWidth="sm">
        <div className="space-y-4">
            <div>
                <p className="text-xs text-zinc-500 mb-2">Adicione ou remova etiquetas para organizar este contato.</p>
                <TagSelector tags={tags} onChange={setTags} />
            </div>
            <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={loading} className="w-full">
                    <Save className="w-4 h-4 mr-2" /> Salvar Etiquetas
                </Button>
            </div>
        </div>
    </Modal>
  );
}
