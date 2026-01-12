import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKanban } from '@/hooks/useKanban';
import { useTeam } from '@/hooks/useTeam';
import { useToast } from '@/hooks/useToast';
import { Save, Plus, X, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewPipelineModal({ isOpen, onClose }: NewPipelineModalProps) {
  const { createPipeline } = useKanban();
  const { members } = useTeam();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [stages, setStages] = useState(['Novo', 'Em Negociação', 'Fechado']);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const handleCreate = async () => {
      if(!name.trim() || stages.some(s => !s.trim())) {
          addToast({ type: 'warning', title: 'Atenção', message: 'Preencha todos os campos.' });
          return;
      }
      setLoading(true);
      try {
          await createPipeline({ name, stages, assignedUserIds });
          onClose();
          setName('');
          setStages(['Novo', 'Em Negociação', 'Fechado']);
          setAssignedUserIds([]);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const toggleUser = (userId: string) => {
      setAssignedUserIds(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Funil de Vendas" maxWidth="md">
        <div className="space-y-6">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Nome do Funil</label>
                <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ex: Pós-Venda, Suporte, Vendas Enterprise..." 
                    className="mt-1"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Etapas do Funil</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                    {stages.map((stage, idx) => (
                        <div key={idx} className="flex gap-2">
                            <span className="flex items-center justify-center w-6 text-zinc-600 font-mono text-xs">{idx + 1}</span>
                            <Input 
                                value={stage} 
                                onChange={e => {
                                    const newStages = [...stages];
                                    newStages[idx] = e.target.value;
                                    setStages(newStages);
                                }}
                                placeholder={`Nome da etapa`}
                            />
                            {stages.length > 2 && (
                                <Button variant="ghost" size="icon" onClick={() => setStages(stages.filter((_, i) => i !== idx))}>
                                    <X className="w-4 h-4 text-zinc-500" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-xs border-dashed border-zinc-700 w-full"
                    onClick={() => setStages([...stages, ''])}
                >
                    <Plus className="w-3 h-3 mr-2" /> Adicionar Etapa
                </Button>
            </div>

            {/* User Assignment Section */}
            <div>
                 <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                    <Users className="w-3 h-3" /> Acesso ao Funil
                 </label>
                 <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                    {members.map(member => (
                        <div 
                            key={member.id}
                            onClick={() => toggleUser(member.id)}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all select-none",
                                assignedUserIds.includes(member.id) 
                                    ? "bg-primary/10 border-primary/30 text-white" 
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                        >
                            <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", assignedUserIds.includes(member.id) ? "bg-primary border-primary" : "border-zinc-600")}>
                                {assignedUserIds.includes(member.id) && <Check className="w-3 h-3 text-black" />}
                            </div>
                            <span className="text-sm truncate">{member.name}</span>
                        </div>
                    ))}
                 </div>
                 <p className="text-[10px] text-zinc-500 mt-2">
                    *Admins e o Proprietário têm acesso total por padrão.
                 </p>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleCreate} isLoading={loading}>
                    <Save className="w-4 h-4 mr-2" /> Criar Funil
                </Button>
            </div>
        </div>
    </Modal>
  );
}