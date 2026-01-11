import { Modal } from '@/components/ui/Modal';
import { Lead } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Trash2, Save } from 'lucide-react';

interface LeadDetailsModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose }: LeadDetailsModalProps) {
  const [data, setData] = useState<Lead>(lead);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { addToast } = useToast();

  const handleSave = async () => {
      setLoading(true);
      const { error } = await supabase.from('leads').update({
          name: data.name,
          phone: data.phone,
          email: data.email,
          value_potential: data.value_potential,
          notes: data.notes
      }).eq('id', data.id);

      setLoading(false);
      if(error) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } else {
          addToast({ type: 'success', title: 'Salvo', message: 'Lead atualizado.' });
          onClose();
      }
  };

  const handleDelete = async () => {
      if(!confirm('Excluir este lead permanentemente?')) return;
      setLoading(true);
      await supabase.from('leads').delete().eq('id', data.id);
      setLoading(false);
      onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Lead">
        <div className="space-y-4">
            <div>
                <label className="text-xs text-zinc-500 uppercase font-bold">Nome</label>
                <Input value={data.name} onChange={e => setData({...data, name: e.target.value})} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold">Telefone</label>
                    <Input value={data.phone} onChange={e => setData({...data, phone: e.target.value})} className="mt-1" />
                </div>
                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold">Valor (R$)</label>
                    <Input type="number" value={data.value_potential} onChange={e => setData({...data, value_potential: Number(e.target.value)})} className="mt-1" />
                </div>
            </div>
            <div>
                <label className="text-xs text-zinc-500 uppercase font-bold">Email</label>
                <Input value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="mt-1" />
            </div>
            <div>
                <label className="text-xs text-zinc-500 uppercase font-bold">Notas</label>
                <Textarea value={data.notes || ''} onChange={e => setData({...data, notes: e.target.value})} className="mt-1 h-32" />
            </div>
            
            <div className="flex justify-between pt-4 border-t border-zinc-800">
                <Button variant="destructive" onClick={handleDelete} isLoading={loading}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
                <Button onClick={handleSave} isLoading={loading}>
                    <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
            </div>
        </div>
    </Modal>
  );
}