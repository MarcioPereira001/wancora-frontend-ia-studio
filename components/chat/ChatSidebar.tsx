
import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Lead } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useLeadData } from '@/hooks/useLeadData';
import { useLeadActivities } from '@/hooks/useLeadActivities';
import { 
  User, Save, CheckSquare, Brain, Plus, X, DollarSign, UserPlus, Ban, Lock,
  Layout, Activity, Clock, Calendar, Link as LinkIcon, ExternalLink, Edit2, RefreshCw, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagSelector } from '@/components/crm/TagSelector';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { DeadlineTimer } from '@/components/crm/DeadlineTimer';

interface ChatSidebarProps {
  contact: ChatContact;
  lead: Lead | null;
  refreshLead: () => void;
  onClose: () => void; // Prop para fechar
}

export function ChatSidebar({ contact, lead, refreshLead, onClose }: ChatSidebarProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();

  const { 
      checklist, links, addCheckitem, toggleCheckitem, deleteCheckitem, 
      updateCheckitemDeadline, addLink, deleteLink 
  } = useLeadData(lead?.id);
  
  const { logSystemActivity } = useLeadActivities(lead?.id);

  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'activities'>('details');
  const [loading, setLoading] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Contact Data (Agenda)
  const [contactName, setContactName] = useState('');
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Lead Data (CRM)
  const [leadName, setLeadName] = useState('');
  const [value, setValue] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [botStatus, setBotStatus] = useState<'active' | 'paused' | 'off'>('active');
  
  // Deadline
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  // Inputs Extras
  const [newItemText, setNewItemText] = useState('');
  const [showTaskDeadlineInput, setShowTaskDeadlineInput] = useState(false);
  const [taskDeadlineDate, setTaskDeadlineDate] = useState('');
  const [taskDeadlineTime, setTaskDeadlineTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // 1. Data Sync
  useEffect(() => {
    const loadData = async () => {
        if(!user?.company_id) return;
        
        const { data: contactData } = await supabase
            .from('contacts')
            .select('name, is_ignored')
            .eq('jid', contact.remote_jid)
            .eq('company_id', user.company_id)
            .maybeSingle();
        
        if (contactData) {
            setIsIgnored(contactData.is_ignored || false);
            setContactName(contactData.name || '');
        }

        if (lead) {
            setLeadName(lead.name || '');
            setValue(lead.value_potential || 0);
            setTags(lead.tags || []);
            setBotStatus(lead.bot_status || 'active');
            
            setHasDeadline(!!lead.deadline);
            if (lead.deadline) {
                const d = new Date(lead.deadline);
                setDeadlineDate(d.toISOString().split('T')[0]);
                setDeadlineTime(d.toTimeString().slice(0, 5));
            } else {
                setDeadlineDate('');
                setDeadlineTime('');
            }
        } else {
            setLeadName(contact.name || contact.push_name || contact.phone_number || '');
            setValue(0);
            setTags([]);
            setHasDeadline(false);
        }
    };
    loadData();
  }, [contact.remote_jid, lead, user?.company_id]);

  const saveContactName = async () => {
      if(!user?.company_id) return;
      try {
          await supabase.from('contacts').update({ 
              name: contactName,
              updated_at: new Date().toISOString()
          }).eq('jid', contact.remote_jid).eq('company_id', user.company_id);
          
          addToast({ type: 'success', title: 'Agenda Atualizada', message: 'Nome salvo na agenda.' });
          setIsEditingContact(false);
          refreshLead();
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar nome.' });
      }
  };

  const handleForceRefresh = async () => {
      setRefreshing(true);
      await new Promise(r => setTimeout(r, 1000));
      refreshLead();
      setRefreshing(false);
      addToast({ type: 'info', title: 'Sincronizado', message: 'Dados recarregados.' });
  };

  const ensurePipelineExists = async () => {
      if (!user?.company_id) throw new Error("Usuário sem empresa.");
      const { data: existingStage } = await supabase.from('pipeline_stages').select('id').eq('company_id', user.company_id).limit(1).maybeSingle();
      if (existingStage) return existingStage.id;
      let { data: pipe } = await supabase.from('pipelines').select('id').eq('company_id', user.company_id).limit(1).maybeSingle();
      if (!pipe) {
          const { data: newPipe } = await supabase.from('pipelines').insert({ company_id: user.company_id, name: 'Funil Padrão', is_default: true }).select().single();
          pipe = newPipe;
      }
      const { data: newStage } = await supabase.from('pipeline_stages').insert({ company_id: user.company_id, pipeline_id: pipe!.id, name: 'Novo Lead', position: 0, color: '#3b82f6' }).select().single();
      return newStage!.id;
  };

  const handleAddToCRM = async () => {
      if (!user?.company_id) return;
      setLoading(true);
      try {
          await supabase.from('contacts').upsert({
              jid: contact.remote_jid,
              company_id: user.company_id,
              is_ignored: false,
              name: contactName || contact.push_name,
              updated_at: new Date().toISOString()
          }, { onConflict: 'jid' });
          
          if (!lead) {
              const stageId = await ensurePipelineExists();
              const cleanPhone = contact.remote_jid.split('@')[0].replace(/\D/g, '');
              const { error } = await supabase.from('leads').insert({
                  company_id: user.company_id,
                  pipeline_stage_id: stageId,
                  name: leadName || contactName || contact.push_name || cleanPhone || 'Novo Lead',
                  phone: cleanPhone,
                  status: 'new',
                  owner_id: user.id,
                  value_potential: 0,
                  temperature: 'cold',
                  bot_status: 'active'
              });
              if(error) throw error;
              addToast({ type: 'success', title: 'Sucesso', message: 'Lead criado no CRM.' });
          }
          
          setIsIgnored(false);
          setTimeout(() => refreshLead(), 300);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const handleRemoveFromCRM = async () => {
      if (!user?.company_id) return;
      if (!confirm("Isso removerá o lead e bloqueará a IA. Continuar?")) return;
      setLoading(true);
      try {
          await supabase.from('contacts')
            .update({ is_ignored: true, updated_at: new Date().toISOString() })
            .eq('jid', contact.remote_jid)
            .eq('company_id', user.company_id);
          
          const cleanPhone = contact.remote_jid.split('@')[0].replace(/\D/g, '');
          await supabase.from('leads').delete().eq('company_id', user.company_id).ilike('phone', `%${cleanPhone}%`);

          addToast({ type: 'info', title: 'Removido', message: 'Contato movido para ignorados.' });
          setIsIgnored(true);
          setTimeout(() => refreshLead(), 300);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const handleSaveLead = async () => {
      if (!lead) return;
      setLoading(true);
      try {
          let finalDeadline = null;
          if (hasDeadline && deadlineDate) {
              const time = deadlineTime || '23:59';
              finalDeadline = new Date(`${deadlineDate}T${time}`).toISOString();
          }

          const changes: string[] = [];
          if (leadName !== lead.name) changes.push(`Nome alterado para "${leadName}"`);
          if (finalDeadline !== lead.deadline) changes.push(finalDeadline ? 'Prazo definido' : 'Prazo removido');
          if (botStatus !== lead.bot_status) changes.push(`Bot: ${botStatus}`);

          const { error } = await supabase.from('leads').update({
              name: leadName,
              value_potential: value,
              tags,
              bot_status: botStatus,
              deadline: finalDeadline
          }).eq('id', lead.id);
          
          if (error) throw error;
          
          if (changes.length > 0) await logSystemActivity(changes.join(', '));
          else await logSystemActivity('Dados atualizados via Chat');

          addToast({ type: 'success', title: 'Salvo', message: 'Dados atualizados.' });
          refreshLead();
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newItemText.trim()) return;
      let deadlineISO = undefined;
      if (showTaskDeadlineInput && taskDeadlineDate) {
          const time = taskDeadlineTime || '12:00';
          deadlineISO = new Date(`${taskDeadlineDate}T${time}`).toISOString();
      }
      await addCheckitem(newItemText, deadlineISO);
      await logSystemActivity(`Nova tarefa: "${newItemText}"`);
      setNewItemText('');
      setTaskDeadlineDate('');
      setShowTaskDeadlineInput(false);
  };

  const handleUpdateTaskDeadline = async (id: string) => {
      if (!taskDeadlineDate) await updateCheckitemDeadline(id, null);
      else {
          const time = taskDeadlineTime || '12:00';
          const iso = new Date(`${taskDeadlineDate}T${time}`).toISOString();
          await updateCheckitemDeadline(id, iso);
      }
      setEditingTaskId(null);
      setTaskDeadlineDate('');
  };

  const handleAddLink = async () => {
      if(!newLinkTitle.trim() || !newLinkUrl.trim()) return;
      await addLink(newLinkTitle, newLinkUrl);
      await logSystemActivity(`Link adicionado: ${newLinkTitle}`);
      setNewLinkTitle('');
      setNewLinkUrl('');
  };

  const displayContactName = contactName || contact.push_name || contact.phone_number || "Desconhecido";

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/95 backdrop-blur-md flex flex-col h-full overflow-hidden animate-in slide-in-from-right-4 relative z-40">
        
        {/* BOTÃO FECHAR */}
        <div className="absolute top-2 right-2 z-50">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-white hover:bg-zinc-800">
                <ChevronRight className="w-5 h-5" />
            </Button>
        </div>

        <div className="p-6 border-b border-zinc-800 flex flex-col items-center text-center shrink-0 relative group/header mt-4">
            <div className="absolute top-4 left-4 opacity-0 group-hover/header:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={handleForceRefresh} disabled={refreshing}>
                    <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                </Button>
            </div>

            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 mb-3 overflow-hidden shadow-lg relative">
                {contact.profile_pic_url ? (
                    <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                ) : (
                    <User className="w-8 h-8 text-zinc-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
            </div>
            
            <div className="w-full relative group">
                {isEditingContact ? (
                    <div className="flex items-center gap-1 animate-in fade-in">
                        <Input 
                            value={contactName} 
                            onChange={e => setContactName(e.target.value)} 
                            className="h-8 text-sm text-center bg-zinc-950 border-primary"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveContactName()}
                        />
                        <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-500" onClick={saveContactName}>
                            <Save className="w-3 h-3" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <h3 className="font-bold text-white text-lg leading-tight truncate max-w-[200px]">
                            {displayContactName}
                        </h3>
                        <button onClick={() => setIsEditingContact(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white">
                            <Edit2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
                {contactName && contact.push_name && contactName !== contact.push_name && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">Perfil: {contact.push_name}</p>
                )}
            </div>

            <p className="text-zinc-500 text-xs font-mono mt-1 mb-4">{contact.phone_number}</p>
            
            <div className="w-full px-2">
                {isIgnored || !lead ? (
                    <Button onClick={handleAddToCRM} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 transition-all active:scale-95">
                        <UserPlus className="w-4 h-4 mr-2" /> Adicionar ao CRM
                    </Button>
                ) : (
                    <Button onClick={handleRemoveFromCRM} disabled={loading} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 transition-all active:scale-95">
                        <Ban className="w-4 h-4 mr-2" /> Remover do CRM
                    </Button>
                )}
            </div>
        </div>

        {!isIgnored && lead ? (
            <>
                <div className="flex border-b border-zinc-800 shrink-0 bg-zinc-900/30">
                    <button onClick={() => setActiveTab('details')} className={cn("flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1", activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                        <Layout className="w-3 h-3" /> Dados
                    </button>
                    <button onClick={() => setActiveTab('checklist')} className={cn("flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1", activeTab === 'checklist' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                        <CheckSquare className="w-3 h-3" /> <span className="bg-zinc-800 px-1 rounded-full">{checklist.length}</span>
                    </button>
                    <button onClick={() => setActiveTab('activities')} className={cn("flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1", activeTab === 'activities' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                        <Activity className="w-3 h-3" /> Logs
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* ... (Conteúdo das Tabs mantido igual, mas dentro do scroll) ... */}
                    {activeTab === 'details' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-2 mb-2">
                                    <Brain className="w-3 h-3 text-purple-500" /> Automação (Sentinela)
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                    {['active', 'paused', 'off'].map((status) => (
                                        <button key={status} onClick={() => setBotStatus(status as any)} className={cn("text-[10px] py-1.5 rounded border capitalize transition-all font-medium", botStatus === status ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800")}>
                                            {status === 'active' ? 'Ativo' : status === 'paused' ? 'Pausa' : 'Off'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-zinc-400 flex items-center gap-2"><User className="w-3 h-3" /> Dados do Lead</label>
                                <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Nome no Pipeline" className="bg-zinc-950 h-9 text-sm border-zinc-800" />
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                    <Input type="number" value={value} onChange={e => setValue(Number(e.target.value))} placeholder="Valor Estimado" className="bg-zinc-950 h-9 text-sm pl-8 border-zinc-800" />
                                </div>
                                <TagSelector tags={tags} onChange={setTags} />
                            </div>
                            <Button onClick={handleSaveLead} disabled={loading} className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none">
                                <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                            </Button>
                        </div>
                    )}
                    {activeTab === 'checklist' && (
                        <div className="space-y-6 animate-in fade-in">
                            <form onSubmit={handleAddChecklist} className="space-y-2">
                                <div className="flex gap-2">
                                    <Input value={newItemText} onChange={e => setNewItemText(e.target.value)} placeholder="Nova tarefa..." className="h-8 text-xs bg-zinc-950 border-zinc-800 flex-1" />
                                    <Button type="button" size="icon" variant={showTaskDeadlineInput ? "secondary" : "ghost"} onClick={() => setShowTaskDeadlineInput(!showTaskDeadlineInput)} className="h-8 w-8 shrink-0 border border-zinc-700"><Clock className={cn("w-3 h-3", showTaskDeadlineInput ? "text-purple-400" : "text-zinc-500")} /></Button>
                                    <Button type="submit" size="icon" className="h-8 w-8 shrink-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"><Plus className="w-3 h-3" /></Button>
                                </div>
                                {showTaskDeadlineInput && (
                                    <div className="flex items-center gap-1 bg-zinc-950 p-1.5 rounded border border-zinc-800 animate-in slide-in-from-top-1">
                                        <input type="date" value={taskDeadlineDate} onChange={e => setTaskDeadlineDate(e.target.value)} className="bg-transparent text-[10px] text-white border border-zinc-700 rounded px-1 py-0.5 outline-none flex-1" />
                                        <input type="time" value={taskDeadlineTime} onChange={e => setTaskDeadlineTime(e.target.value)} className="bg-transparent text-[10px] text-white border border-zinc-700 rounded px-1 py-0.5 outline-none w-16" />
                                    </div>
                                )}
                            </form>
                            <div className="space-y-2">
                                {checklist.map(item => (
                                    <div key={item.id} className="flex flex-col p-2 rounded-lg bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 group">
                                        <div className="flex items-start gap-2">
                                            <Checkbox checked={item.is_completed} onCheckedChange={() => { toggleCheckitem(item.id, item.is_completed); if(!item.is_completed) logSystemActivity(`Concluiu tarefa: ${item.text}`); }} className="mt-0.5 w-3.5 h-3.5 border-zinc-600 data-[state=checked]:bg-green-600" />
                                            <div className="flex-1">
                                                <span className={cn("text-xs block break-words leading-tight", item.is_completed ? "text-zinc-600 line-through" : "text-zinc-300")}>{item.text}</span>
                                                {item.deadline && !item.is_completed && <div className="mt-1"><DeadlineTimer deadline={item.deadline} compact /></div>}
                                            </div>
                                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => deleteCheckitem(item.id)} className="text-zinc-500 hover:text-red-500 p-0.5"><X className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'activities' && (
                        <div className="animate-in fade-in h-full"><ActivityTimeline leadId={lead.id} /></div>
                    )}
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-4">
                <div className="p-4 bg-zinc-900/50 rounded-full border border-zinc-800"><Lock className="w-8 h-8 text-zinc-600" /></div>
                <div>
                    <p className="text-sm font-bold text-zinc-300">Fora do CRM</p>
                    <p className="text-xs mt-2 max-w-[200px] mx-auto opacity-70">Adicione este contato ao CRM para habilitar o robô, checklist e edição de dados.</p>
                </div>
            </div>
        )}
    </div>
  );
}
