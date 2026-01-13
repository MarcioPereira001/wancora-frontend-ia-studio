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
import { useLeadActivities } from '@/hooks/useLeadActivities';
import { useTeam } from '@/hooks/useTeam';
import { Trash2, Save, CheckSquare, Layout, Activity, Plus, User, Clock, Link as LinkIcon, ExternalLink, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/utils/supabase/client';
import { ActivityTimeline } from './ActivityTimeline';
import { DeadlineTimer } from './DeadlineTimer';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose }: LeadDetailsModalProps) {
  const { updateLead, deleteLead } = useKanban();
  const { checklist, addCheckitem, toggleCheckitem, updateCheckitemDeadline, deleteCheckitem, links, addLink, deleteLink } = useLeadData(lead?.id, lead?.phone);
  const { logSystemActivity } = useLeadActivities(lead?.id);
  const { members } = useTeam(); 
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'activities'>('details');
  const [data, setData] = useState<Lead>(lead || {} as Lead);
  const [loading, setLoading] = useState(false);
  
  // Checklist State
  const [newItemText, setNewItemText] = useState('');
  const [newItemDeadline, setNewItemDeadline] = useState(''); // Temp state para nova tarefa
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null); // ID da tarefa que está editando prazo

  // Links State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Lead Deadline State
  const [hasDeadline, setHasDeadline] = useState(!!lead?.deadline);

  useEffect(() => {
    if (lead) {
        setData(lead);
        setHasDeadline(!!lead.deadline);
    }
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
            owner_id: data.owner_id,
            deadline: hasDeadline ? data.deadline : null // Remove se toggle off
        }});
        
        await logSystemActivity(`Dados do lead atualizados.`);
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

  // --- CHECKLIST LOGIC ---
  const handleAddChecklist = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newItemText.trim()) return;
      
      // Converte deadline para ISO se existir
      let deadlineISO = undefined;
      if (newItemDeadline) {
          deadlineISO = new Date(newItemDeadline).toISOString();
      }

      await addCheckitem(newItemText, deadlineISO);
      await logSystemActivity(`Adicionou tarefa: "${newItemText}"`);
      setNewItemText('');
      setNewItemDeadline('');
  };

  const handleToggleTask = async (id: string, currentStatus: boolean, text: string) => {
      await toggleCheckitem(id, currentStatus);
      if(!currentStatus) await logSystemActivity(`Concluiu tarefa: "${text}"`);
  };

  const handleTaskDeadlineUpdate = async (id: string, dateStr: string) => {
      const iso = dateStr ? new Date(dateStr).toISOString() : null;
      await updateCheckitemDeadline(id, iso);
      setEditingTaskId(null);
  };

  // --- LINKS LOGIC ---
  const handleAddLink = async () => {
      if(!newLinkTitle.trim() || !newLinkUrl.trim()) return;
      await addLink(newLinkTitle, newLinkUrl);
      setNewLinkTitle('');
      setNewLinkUrl('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes: ${data.name}`} maxWidth="lg">
        {/* Tabs Header */}
        <div className="flex border-b border-zinc-800 mb-6">
            <button onClick={() => setActiveTab('details')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                <Layout className="w-4 h-4" /> Dados
            </button>
            <button onClick={() => setActiveTab('checklist')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'checklist' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                <CheckSquare className="w-4 h-4" /> Tarefas <span className="text-xs bg-zinc-800 px-1.5 rounded-full">{checklist.length}</span>
            </button>
            <button onClick={() => setActiveTab('activities')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'activities' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                <Activity className="w-4 h-4" /> Atividades
            </button>
        </div>

        {/* Tab: Dados */}
        {activeTab === 'details' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Nome</label>
                        <Input value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Telefone</label>
                        <Input value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} className="mt-1" />
                    </div>
                </div>
                
                {/* Deadline Control */}
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-purple-500" /> Prazo de Fechamento (Deadline)
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500">{hasDeadline ? 'Ativo' : 'Inativo'}</span>
                            <div 
                                onClick={() => setHasDeadline(!hasDeadline)}
                                className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", hasDeadline ? "bg-purple-600" : "bg-zinc-700")}
                            >
                                <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", hasDeadline ? "left-4.5" : "left-0.5")} />
                            </div>
                        </div>
                    </div>
                    
                    {hasDeadline && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                            <Input 
                                type="datetime-local" 
                                value={data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : ''}
                                onChange={e => setData({...data, deadline: new Date(e.target.value).toISOString()})}
                                className="text-xs bg-zinc-950 border-zinc-800 h-9"
                            />
                            {data.deadline && <DeadlineTimer deadline={data.deadline} />}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Valor (R$)</label>
                        <Input type="number" value={data.value_potential || 0} onChange={e => setData({...data, value_potential: Number(e.target.value)})} className="mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 uppercase font-bold">Responsável</label>
                        <div className="relative mt-1">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                            <select 
                                value={data.owner_id || ''}
                                onChange={e => setData({...data, owner_id: e.target.value})}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-primary appearance-none"
                            >
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                
                <TagSelector tags={data.tags || []} onChange={tags => setData({...data, tags})} />
                <Textarea value={data.notes || ''} onChange={e => setData({...data, notes: e.target.value})} className="mt-1 h-24" placeholder="Descrição geral do lead..." />
                
                <div className="pt-4 border-t border-zinc-800 flex justify-between">
                    <Button variant="destructive" onClick={handleDelete} isLoading={loading} className="bg-zinc-800 text-zinc-400 hover:bg-red-600 hover:text-white border border-zinc-700">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </Button>
                    <Button onClick={handleSave} isLoading={loading}>
                        <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                </div>
            </div>
        )}

        {/* Tab: Checklist */}
        {activeTab === 'checklist' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 min-h-[300px]">
                {/* Add Form */}
                <form onSubmit={handleAddChecklist} className="space-y-2 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800">
                    <div className="flex gap-2">
                        <Input 
                            value={newItemText}
                            onChange={e => setNewItemText(e.target.value)}
                            placeholder="Nova tarefa..."
                            className="flex-1 border-zinc-700"
                        />
                        <Button type="submit" disabled={!newItemText.trim()} size="icon" className="shrink-0">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    {/* Optional Deadline for New Task */}
                    <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <input 
                            type="datetime-local" 
                            value={newItemDeadline}
                            onChange={e => setNewItemDeadline(e.target.value)}
                            className="bg-transparent text-xs text-zinc-400 outline-none hover:text-white cursor-pointer"
                        />
                        {!newItemDeadline && <span className="text-[10px] text-zinc-600">(Opcional) Adicionar prazo</span>}
                    </div>
                </form>

                <div className="space-y-2 mt-4">
                    {checklist.map(item => (
                        <div key={item.id} className="flex flex-col p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                             <div className="flex items-start gap-3">
                                 <Checkbox 
                                    id={item.id}
                                    checked={item.is_completed}
                                    onCheckedChange={() => handleToggleTask(item.id, item.is_completed, item.text)}
                                    className="mt-0.5 border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                 />
                                 <div className="flex-1">
                                    <label 
                                        htmlFor={item.id} 
                                        className={cn("text-sm cursor-pointer leading-relaxed block", item.is_completed ? "text-zinc-500 line-through decoration-zinc-600" : "text-zinc-200")}
                                    >
                                        {item.text}
                                    </label>
                                    
                                    {/* Timer Display */}
                                    {item.deadline && !item.is_completed && (
                                        <div className="mt-1">
                                            <DeadlineTimer deadline={item.deadline} compact />
                                        </div>
                                    )}
                                 </div>
                                 
                                 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button 
                                        onClick={() => setEditingTaskId(editingTaskId === item.id ? null : item.id)}
                                        className={cn("p-1.5 rounded hover:bg-zinc-800 text-zinc-500", item.deadline ? "text-purple-400" : "")}
                                        title="Definir Prazo"
                                     >
                                         <Clock size={14} />
                                     </button>
                                     <button onClick={() => deleteCheckitem(item.id)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-500">
                                         <X size={14} />
                                     </button>
                                 </div>
                             </div>

                             {/* Inline Deadline Edit */}
                             {editingTaskId === item.id && (
                                 <div className="mt-2 pl-7 flex items-center gap-2 animate-in slide-in-from-top-1">
                                     <Input 
                                        type="datetime-local" 
                                        defaultValue={item.deadline ? new Date(item.deadline).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => handleTaskDeadlineUpdate(item.id, e.target.value)}
                                        className="h-7 text-xs w-auto bg-zinc-950"
                                     />
                                     <button onClick={() => handleTaskDeadlineUpdate(item.id, '')} className="text-[10px] text-red-400 hover:underline">Remover Prazo</button>
                                 </div>
                             )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Tab: Atividades & Links */}
        {activeTab === 'activities' && (
            <div className="flex flex-col h-[500px] animate-in fade-in">
                {/* Links Section */}
                <div className="mb-4 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2 flex items-center gap-2">
                        <LinkIcon className="w-3 h-3" /> Links Úteis
                    </h4>
                    
                    <div className="flex gap-2 mb-2">
                        <Input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Título (ex: Site)" className="h-7 text-xs flex-1" />
                        <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="URL (https://...)" className="h-7 text-xs flex-[2]" />
                        <Button size="icon" className="h-7 w-7" onClick={handleAddLink}><Plus className="w-3 h-3" /></Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {links.map(link => (
                            <div key={link.id} className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs group hover:border-zinc-600">
                                <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline">
                                    {link.title} <ExternalLink size={10} />
                                </a>
                                <button onClick={() => deleteLink(link.id)} className="ml-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={10} /></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ActivityTimeline leadId={data.id} />
                </div>
            </div>
        )}
    </Modal>
  );
}