import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Lead } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagSelector } from './TagSelector';
import { useToast } from '@/hooks/useToast';
import { useKanban } from '@/hooks/useKanban';
import { useLeadData } from '@/hooks/useLeadData';
import { useTeam } from '@/hooks/useTeam';
import { Trash2, Save, CheckSquare, Layout, Clock, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose }: LeadDetailsModalProps) {
  const { updateLead, deleteLead } = useKanban();
  const { checklist, addCheckitem, toggleCheckitem } = useLeadData(lead?.id, lead?.phone);
  const { members } = useTeam(); 
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'history'>('details');
  const [data, setData] = useState<Lead>(lead || {} as Lead);
  const [loading, setLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (lead) setData(lead);
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
      setLoading(true);
      try {
        await updateLead({ id: data.id, data: {
            name: data.name,
            phone: data.phone,
            email: data.email,
            value_potential: data.value_potential,
            notes: data.notes,
            tags: data.tags,
            temperature: data.temperature,
            owner_id: data.owner_id // Atualiza o dono
        }});
        addToast({ type: 'success', title: 'Salvo', message: 'Lead atualizado.' });
        onClose();
      } catch (error: any) {
        addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
        setLoading(false);
      }
  };

  const handleDelete = async () => {
      if(!confirm('Excluir este lead permanentemente?')) return;
      setLoading(true);
      try {
        await deleteLead(data.id);
        onClose();
      } catch (error: any) {
        addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
        setLoading(false);
      }
  };

  const handleAddChecklist = (e: React.FormEvent) => {
      e.preventDefault();
      if(!newItemText.trim()) return;
      addCheckitem(newItemText);
      setNewItemText('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes: ${data.name}`} maxWidth="lg">
        {/* Tabs Header */}
        <div className="flex border-b border-zinc-800 mb-6">
            <button 
                onClick={() => setActiveTab('details')}
                className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}
            >
                <Layout className="w-4 h-4" /> Dados
            </button>
            <button 
                onClick={() => setActiveTab('checklist')}
                className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'checklist' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}
            >
                <CheckSquare className="w-4 h-4" /> Tarefas <span className="text-xs bg-zinc-800 px-1.5 rounded-full">{checklist.length}</span>
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'history' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}
            >
                <Clock className="w-4 h-4" /> Histórico
            </button>
        </div>

        {/* Tab: Dados */}
        {activeTab === 'details' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold">Nome</label>
                    <Input value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Telefone</label>
                        <Input value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Valor (R$)</label>
                        <Input type="number" value={data.value_potential || 0} onChange={e => setData({...data, value_potential: Number(e.target.value)})} className="mt-1" />
                    </div>
                </div>

                {/* Seletor de Responsável */}
                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold">Responsável (Dono)</label>
                    <div className="relative mt-1">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                        <select 
                            value={data.owner_id || ''}
                            onChange={e => setData({...data, owner_id: e.target.value})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-primary appearance-none"
                        >
                            <option value="" disabled>Selecione um responsável</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.role === 'owner' ? 'Dono' : m.role === 'admin' ? 'Admin' : 'Agente'})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Tags</label>
                    <TagSelector tags={data.tags || []} onChange={tags => setData({...data, tags})} />
                </div>

                <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold">Notas</label>
                    <Textarea value={data.notes || ''} onChange={e => setData({...data, notes: e.target.value})} className="mt-1 h-32" />
                </div>
                
                <div className="flex justify-between pt-4 border-t border-zinc-800 mt-4">
                    <Button variant="destructive" onClick={handleDelete} isLoading={loading} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-none">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </Button>
                    <Button onClick={handleSave} isLoading={loading}>
                        <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                    </Button>
                </div>
            </div>
        )}

        {/* Tab: Checklist */}
        {activeTab === 'checklist' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 min-h-[300px]">
                <form onSubmit={handleAddChecklist} className="flex gap-2">
                    <Input 
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        placeholder="Adicionar nova tarefa..."
                        className="flex-1"
                    />
                    <Button type="submit" disabled={!newItemText.trim()} variant="secondary">
                        <Plus className="w-4 h-4" />
                    </Button>
                </form>

                <div className="space-y-2 mt-4">
                    {checklist.length === 0 && (
                        <p className="text-center text-zinc-500 py-8 text-sm italic">Nenhuma tarefa criada.</p>
                    )}
                    {checklist.map(item => (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                             <Checkbox 
                                id={item.id}
                                checked={item.is_completed}
                                onCheckedChange={() => toggleCheckitem(item.id, item.is_completed)}
                                className="mt-0.5 border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                             />
                             <label 
                                htmlFor={item.id} 
                                className={cn("text-sm flex-1 cursor-pointer leading-relaxed", item.is_completed ? "text-zinc-500 line-through decoration-zinc-600" : "text-zinc-200")}
                             >
                                {item.text}
                             </label>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Tab: Histórico */}
        {activeTab === 'history' && (
            <div className="min-h-[300px] flex items-center justify-center text-zinc-500 italic animate-in fade-in">
                <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>Logs de atividade em breve.</p>
                </div>
            </div>
        )}
    </Modal>
  );
}