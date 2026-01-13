import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Lead } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useLeadData } from '@/hooks/useLeadData'; // Hook sincronizado
import { useLeadActivities } from '@/hooks/useLeadActivities'; // Hook de atividades
import { 
  User, Save, CheckSquare, Brain, Plus, X, DollarSign, UserPlus, Ban, Lock,
  Layout, Activity, Clock, Calendar, Link as LinkIcon, ExternalLink
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
}

export function ChatSidebar({ contact, lead, refreshLead }: ChatSidebarProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();

  // Hooks do CRM (Só ativam se tiver Lead ID)
  const { 
      checklist, links, addCheckitem, toggleCheckitem, deleteCheckitem, 
      updateCheckitemDeadline, addLink, deleteLink 
  } = useLeadData(lead?.id);
  
  const { logSystemActivity } = useLeadActivities(lead?.id);

  // UI States
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'activities'>('details');
  const [loading, setLoading] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);
  
  // Lead Data Form
  const [name, setName] = useState('');
  const [value, setValue] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [botStatus, setBotStatus] = useState<'active' | 'paused' | 'off'>('active');
  
  // Lead Deadline State
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  // Checklist Input State
  const [newItemText, setNewItemText] = useState('');
  const [showTaskDeadlineInput, setShowTaskDeadlineInput] = useState(false);
  const [taskDeadlineDate, setTaskDeadlineDate] = useState('');
  const [taskDeadlineTime, setTaskDeadlineTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Links Input State
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // 1. Load Data
  useEffect(() => {
    const loadData = async () => {
        if(!user?.company_id) return;
        
        const { data: contactData } = await supabase
            .from('contacts')
            .select('is_ignored')
            .eq('jid', contact.remote_jid)
            .eq('company_id', user.company_id)
            .maybeSingle();
        
        if (contactData) setIsIgnored(contactData.is_ignored || false);

        if (lead) {
            setName(lead.name);
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
            setName(contact.name || contact.push_name || '');
            setValue(0);
            setTags([]);
            setHasDeadline(false);
        }
    };
    loadData();
  }, [contact.remote_jid, lead, user?.company_id]);

  // Ensure Pipeline Helper
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

  // ADD TO CRM
  const handleAddToCRM = async () => {
      if (!user?.company_id) return;
      setLoading(true);
      try {
          await supabase.from('contacts').upsert({
              jid: contact.remote_jid,
              company_id: user.company_id,
              is_ignored: false,
              name: contact.name || contact.push_name,
              updated_at: new Date().toISOString()
          }, { onConflict: 'jid' });
          
          if (!lead) {
              const stageId = await ensurePipelineExists();
              const cleanPhone = contact.remote_jid.split('@')[0].replace(/\D/g, '');
              await supabase.from('leads').insert({
                  company_id: user.company_id,
                  pipeline_stage_id: stageId,
                  name: name || contact.push_name || 'Novo Lead',
                  phone: cleanPhone,
                  status: 'new',
                  owner_id: user.id,
                  value_potential: 0,
                  temperature: 'cold',
                  bot_status: 'active'
              });
              addToast({ type: 'success', title: 'Sucesso', message: 'Lead criado no CRM.' });
          }
          setIsIgnored(false);
          setTimeout(() => refreshLead(), 500);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setLoading(false);
      }
  };

  // REMOVE FROM CRM
  const handleRemoveFromCRM = async () => {
      if (!user?.company_id) return;
      if (!confirm("Isso removerá o lead e bloqueará a IA. Continuar?")) return;
      setLoading(true);
      try {
          await supabase.from('contacts').update({ is_ignored: true, updated_at: new Date().toISOString() }).eq('jid', contact.remote_jid).eq('company_id', user.company_id);
          const cleanPhone = contact.remote_jid.split('@')[0].replace(/\D/g, '');
          await supabase.from('leads').delete().eq('company_id', user.company_id).ilike('phone', `%${cleanPhone}%`); 
          addToast({ type: 'info', title: 'Removido', message: 'Lead removido e contato pausado.' });
          setIsIgnored(true);
          setTimeout(() => refreshLead(), 500);
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
          if (finalDeadline !== lead.deadline) changes.push(finalDeadline ? 'Prazo definido' : 'Prazo removido');
          if (botStatus !== lead.bot_status) changes.push(`Bot: ${botStatus}`);

          const { error } = await supabase.from('leads').update({
              name,
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

  // --- CHECKLIST & LINKS HANDLERS ---
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
      if (!taskDeadlineDate) {
          await updateCheckitemDeadline(id, null);
      } else {
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

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full overflow-hidden animate-in slide-in-from-right-4">
        
        {/* Header Profile */}
        <div className="p-6 border-b border-zinc-800 flex flex-col items-center text-center shrink-0">
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 mb-3 overflow-hidden shadow-lg relative">
                {contact.profile_pic_url ? (
                    <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                ) : (
                    <User className="w-8 h-8 text-zinc-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
            </div>
            <h3 className="font-bold text-white text-lg leading-tight truncate w-full">{name || 'Visitante'}</h3>
            <p className="text-zinc-500 text-xs font-mono mt-1">{contact.phone_number}</p>
            
            <div className="mt-4 w-full px-2">
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

        {/* Lead Controls (Tabs) */}
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
                    {/* --- TAB 1: DADOS & PRAZOS --- */}
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

                            {/* Deadline Control */}
                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-purple-500" /> Deadline Lead
                                    </label>
                                    <div 
                                        onClick={() => setHasDeadline(!hasDeadline)}
                                        className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", hasDeadline ? "bg-purple-600" : "bg-zinc-700")}
                                    >
                                        <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", hasDeadline ? "left-4.5" : "left-0.5")} />
                                    </div>
                                </div>
                                {hasDeadline && (
                                    <div className="animate-in fade-in slide-in-from-top-1 space-y-2">
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <Calendar className="absolute left-2 top-2 w-3 h-3 text-zinc-500" />
                                                <Input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="pl-6 text-[10px] h-7 bg-zinc-950 border-zinc-800" />
                                            </div>
                                            <div className="relative w-20">
                                                <Clock className="absolute left-2 top-2 w-3 h-3 text-zinc-500" />
                                                <Input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} className="pl-6 text-[10px] h-7 bg-zinc-950 border-zinc-800" />
                                            </div>
                                        </div>
                                        {deadlineDate && (
                                            <div className="flex justify-end">
                                                <DeadlineTimer deadline={`${deadlineDate}T${deadlineTime || '23:59'}`} compact />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                                    <User className="w-3 h-3" /> Dados do Lead
                                </label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome no CRM" className="bg-zinc-950 h-9 text-sm border-zinc-800" />
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

                    {/* --- TAB 2: CHECKLIST & LINKS --- */}
                    {activeTab === 'checklist' && (
                        <div className="space-y-6 animate-in fade-in">
                            {/* Checklist Form */}
                            <form onSubmit={handleAddChecklist} className="space-y-2">
                                <div className="flex gap-2">
                                    <Input value={newItemText} onChange={e => setNewItemText(e.target.value)} placeholder="Nova tarefa..." className="h-8 text-xs bg-zinc-950 border-zinc-800 flex-1" />
                                    <Button type="button" size="icon" variant={showTaskDeadlineInput ? "secondary" : "ghost"} onClick={() => setShowTaskDeadlineInput(!showTaskDeadlineInput)} className="h-8 w-8 shrink-0 border border-zinc-700">
                                        <Clock className={cn("w-3 h-3", showTaskDeadlineInput ? "text-purple-400" : "text-zinc-500")} />
                                    </Button>
                                    <Button type="submit" size="icon" className="h-8 w-8 shrink-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700">
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>
                                {showTaskDeadlineInput && (
                                    <div className="flex items-center gap-1 bg-zinc-950 p-1.5 rounded border border-zinc-800 animate-in slide-in-from-top-1">
                                        <input type="date" value={taskDeadlineDate} onChange={e => setTaskDeadlineDate(e.target.value)} className="bg-transparent text-[10px] text-white border border-zinc-700 rounded px-1 py-0.5 outline-none flex-1" />
                                        <input type="time" value={taskDeadlineTime} onChange={e => setTaskDeadlineTime(e.target.value)} className="bg-transparent text-[10px] text-white border border-zinc-700 rounded px-1 py-0.5 outline-none w-16" />
                                    </div>
                                )}
                            </form>

                            {/* Checklist Items */}
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
                                                <button onClick={() => { setEditingTaskId(editingTaskId === item.id ? null : item.id); if(item.deadline) { const d = new Date(item.deadline); setTaskDeadlineDate(d.toISOString().split('T')[0]); setTaskDeadlineTime(d.toTimeString().slice(0,5)); } }} className="text-zinc-500 hover:text-purple-400 p-0.5"><Clock className="w-3 h-3" /></button>
                                                <button onClick={() => deleteCheckitem(item.id)} className="text-zinc-500 hover:text-red-500 p-0.5"><X className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                        {editingTaskId === item.id && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2 animate-in slide-in-from-top-1">
                                                <input type="date" value={taskDeadlineDate} onChange={(e) => setTaskDeadlineDate(e.target.value)} className="h-5 text-[10px] bg-zinc-950 border border-zinc-700 rounded px-1 w-20" />
                                                <input type="time" value={taskDeadlineTime} onChange={(e) => setTaskDeadlineTime(e.target.value)} className="h-5 text-[10px] bg-zinc-950 border border-zinc-700 rounded px-1 w-14" />
                                                <button onClick={() => handleUpdateTaskDeadline(item.id)} className="bg-green-600 text-[10px] text-white px-2 rounded h-5">OK</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Links Section */}
                            <div className="pt-4 border-t border-zinc-800">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Links</h4>
                                <div className="flex gap-1 mb-2">
                                    <Input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Título" className="h-6 text-[10px] flex-1 bg-zinc-950" />
                                    <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="URL" className="h-6 text-[10px] flex-1 bg-zinc-950" />
                                    <Button size="icon" onClick={handleAddLink} className="h-6 w-6"><Plus className="w-3 h-3" /></Button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {links.map(link => (
                                        <div key={link.id} className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] group">
                                            <a href={link.url} target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">{link.title} <ExternalLink size={8} /></a>
                                            <button onClick={() => deleteLink(link.id)} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={8} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB 3: ACTIVITIES --- */}
                    {activeTab === 'activities' && (
                        <div className="animate-in fade-in h-full">
                            <ActivityTimeline leadId={lead.id} />
                        </div>
                    )}
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-4">
                <div className="p-4 bg-zinc-900/50 rounded-full border border-zinc-800">
                    <Lock className="w-8 h-8 text-zinc-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-zinc-300">Fora do CRM</p>
                    <p className="text-xs mt-2 max-w-[200px] mx-auto opacity-70">
                        Adicione este contato ao CRM para habilitar o robô, checklist e edição de dados.
                    </p>
                </div>
                <Button disabled className="w-full opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500 border border-zinc-700">
                    <Save className="w-4 h-4 mr-2" /> Salvar (Bloqueado)
                </Button>
            </div>
        )}
    </div>
  );
}