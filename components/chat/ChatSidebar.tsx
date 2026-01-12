'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Lead, ChecklistItem } from '@/types';
import { useToast } from '@/hooks/useToast';
import { 
  User, Save, CheckSquare, Brain, ToggleLeft, ToggleRight, 
  Trash2, Plus, Clock, Tag as TagIcon, X, DollarSign, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagSelector } from '@/components/crm/TagSelector';
import { cn, formatCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface ChatSidebarProps {
  contact: ChatContact;
  lead: Lead | null;
  refreshLead: () => void;
}

export function ChatSidebar({ contact, lead, refreshLead }: ChatSidebarProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false); // Estado local do contato
  const [botStatus, setBotStatus] = useState<'active' | 'paused' | 'off'>('active');
  
  // Lead Data Form
  const [name, setName] = useState('');
  const [value, setValue] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  
  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  // 1. Load Data
  useEffect(() => {
    const loadData = async () => {
        if(!user?.company_id) return;

        // Load Contact Ignored Status
        const { data: contactData } = await supabase
            .from('contacts')
            .select('is_ignored')
            .eq('jid', contact.remote_jid)
            .single();
        
        if (contactData) setIsIgnored(contactData.is_ignored || false);

        // Load Lead Data (if exists)
        if (lead) {
            setName(lead.name);
            setValue(lead.value_potential || 0);
            setTags(lead.tags || []);
            setBotStatus(lead.bot_status || 'active');

            // Load Checklist
            const { data: list } = await supabase
                .from('lead_checklists')
                .select('*')
                .eq('lead_id', lead.id)
                .order('created_at');
            setChecklist(list || []);
        } else {
            // Default values for potential new lead
            setName(contact.name || contact.push_name || '');
            setValue(0);
            setTags([]);
        }
    };
    loadData();
  }, [contact.remote_jid, lead]);

  // 2. Actions
  const handleToggleIgnore = async () => {
      if (!user?.company_id) return;
      const newStatus = !isIgnored;
      
      try {
          setLoading(true);
          
          if (newStatus) {
              // BANIR: Update Contact -> is_ignored = true AND Delete Lead (if exists)
              if (lead && !confirm("ATENÇÃO: Isso removerá o lead do Pipeline e impedirá que o robô responda. Continuar?")) {
                  setLoading(false);
                  return;
              }

              await supabase.from('contacts').update({ is_ignored: true }).eq('jid', contact.remote_jid);
              
              if (lead) {
                  await supabase.from('leads').delete().eq('id', lead.id);
                  addToast({ type: 'info', title: 'Removido', message: 'Lead removido e contato ignorado.' });
              } else {
                  addToast({ type: 'info', title: 'Ignorado', message: 'Contato adicionado à lista de ignorados.' });
              }

          } else {
              // REATIVAR: Update Contact -> is_ignored = false AND Create Lead
              await supabase.from('contacts').update({ is_ignored: false }).eq('jid', contact.remote_jid);
              
              // Tenta criar lead se não existir
              if (!lead) {
                  // Busca pipeline default
                  const { data: pipe } = await supabase.from('pipelines').select('id').eq('company_id', user.company_id).eq('is_default', true).single();
                  if (pipe) {
                      const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipe.id).eq('position', 0).single();
                      if (stage) {
                          await supabase.from('leads').insert({
                              company_id: user.company_id,
                              pipeline_stage_id: stage.id,
                              name: name || contact.push_name || 'Novo Lead',
                              phone: contact.phone_number || contact.remote_jid.split('@')[0],
                              status: 'open',
                              owner_id: user.id
                          });
                          addToast({ type: 'success', title: 'Criado', message: 'Lead reativado no Pipeline.' });
                      }
                  }
              }
          }
          
          setIsIgnored(newStatus);
          refreshLead();

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
          await supabase.from('leads').update({
              name,
              value_potential: value,
              tags,
              bot_status: botStatus
          }).eq('id', lead.id);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Dados atualizados.' });
          refreshLead();
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar.' });
      } finally {
          setLoading(false);
      }
  };

  const handleChecklist = async (action: 'add' | 'toggle' | 'delete', itemId?: string, status?: boolean) => {
      if (!lead) return;

      if (action === 'add' && newItemText.trim()) {
          const { data } = await supabase.from('lead_checklists').insert({
              lead_id: lead.id,
              text: newItemText,
              is_completed: false
          }).select().single();
          if (data) setChecklist([...checklist, data]);
          setNewItemText('');
      }

      if (action === 'toggle' && itemId) {
          await supabase.from('lead_checklists').update({ is_completed: !status }).eq('id', itemId);
          setChecklist(prev => prev.map(i => i.id === itemId ? { ...i, is_completed: !status } : i));
      }

      if (action === 'delete' && itemId) {
          await supabase.from('lead_checklists').delete().eq('id', itemId);
          setChecklist(prev => prev.filter(i => i.id !== itemId));
      }
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4">
        
        {/* Header Profile */}
        <div className="p-6 border-b border-zinc-800 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 mb-3 overflow-hidden shadow-lg relative">
                {contact.profile_pic_url ? (
                    <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                ) : (
                    <User className="w-8 h-8 text-zinc-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
            </div>
            <h3 className="font-bold text-white text-lg leading-tight">{name || 'Lead Sem Nome'}</h3>
            <p className="text-zinc-500 text-xs font-mono mt-1">{contact.phone_number}</p>
            
            {/* Status Toggle */}
            <div className="mt-4 flex items-center gap-2 bg-zinc-950 rounded-full px-3 py-1 border border-zinc-800">
                <span className={cn("text-[10px] font-bold uppercase", isIgnored ? "text-red-500" : "text-green-500")}>
                    {isIgnored ? "Ignorado (Banido)" : "Sincronizado (Lead)"}
                </span>
                <button onClick={handleToggleIgnore} disabled={loading} className="text-zinc-400 hover:text-white transition-colors">
                    {isIgnored ? <ToggleLeft className="w-6 h-6" /> : <ToggleRight className="w-6 h-6 text-green-500" />}
                </button>
            </div>
        </div>

        {/* Lead Controls (Only if NOT ignored) */}
        {!isIgnored && lead ? (
            <div className="p-4 space-y-6">
                
                {/* 1. Bot Control */}
                <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-2 mb-2">
                        <Brain className="w-3 h-3 text-purple-500" /> Automação (Sentinela)
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                        {['active', 'paused', 'off'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setBotStatus(status as any)}
                                className={cn(
                                    "text-[10px] py-1.5 rounded border capitalize transition-all",
                                    botStatus === status 
                                        ? "bg-purple-500/20 border-purple-500 text-purple-400" 
                                        : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                                )}
                            >
                                {status === 'active' ? 'Ativo' : status === 'paused' ? 'Pausa' : 'Off'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. CRM Data */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                        <User className="w-3 h-3" /> Dados do Lead
                    </label>
                    <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="Nome no CRM"
                        className="bg-zinc-950 h-9 text-sm"
                    />
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                        <Input 
                            type="number"
                            value={value} 
                            onChange={e => setValue(Number(e.target.value))} 
                            placeholder="Valor Estimado"
                            className="bg-zinc-950 h-9 text-sm pl-8"
                        />
                    </div>
                    <TagSelector tags={tags} onChange={setTags} />
                </div>

                {/* 3. Checklist */}
                <div>
                    <label className="text-xs font-bold text-zinc-400 flex items-center gap-2 mb-2">
                        <CheckSquare className="w-3 h-3" /> Tarefas ({checklist.filter(i => i.is_completed).length}/{checklist.length})
                    </label>
                    <div className="space-y-2 mb-3">
                        {checklist.map(item => (
                            <div key={item.id} className="flex items-start gap-2 group">
                                <Checkbox 
                                    checked={item.is_completed}
                                    onCheckedChange={() => handleChecklist('toggle', item.id, item.is_completed)}
                                    className="mt-0.5 w-4 h-4 border-zinc-600"
                                />
                                <span className={cn("text-xs flex-1 break-words", item.is_completed ? "text-zinc-600 line-through" : "text-zinc-300")}>
                                    {item.text}
                                </span>
                                <button onClick={() => handleChecklist('delete', item.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-opacity">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input 
                            value={newItemText} 
                            onChange={e => setNewItemText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleChecklist('add')}
                            placeholder="Nova tarefa..."
                            className="h-7 text-xs bg-zinc-950"
                        />
                        <Button size="icon" onClick={() => handleChecklist('add')} className="h-7 w-7 bg-zinc-800 hover:bg-zinc-700">
                            <Plus className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                <Button onClick={handleSaveLead} disabled={loading} className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20">
                    <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                </Button>

            </div>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                {isIgnored ? (
                    <>
                        <Trash2 className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">Este contato foi ignorado.</p>
                        <p className="text-xs mt-2">Novas mensagens não criarão leads e o robô não responderá.</p>
                        <Button variant="outline" size="sm" onClick={handleToggleIgnore} className="mt-4 border-zinc-800 text-zinc-300">
                            Reativar Contato
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-sm">Carregando dados...</p>
                    </>
                )}
            </div>
        )}
    </div>
  );
}