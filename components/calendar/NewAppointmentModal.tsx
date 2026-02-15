
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { useCalendarStore } from '@/store/useCalendarStore';
import { Calendar, Clock, Repeat, Tag, User, Save, Trash2, CheckSquare, X, Bell, MessageSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Appointment } from '@/types';
import { api } from '@/services/api'; 

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedDate?: Date;
  appointmentToEdit?: Appointment | null; 
}

export function NewAppointmentModal({ isOpen, onClose, preSelectedDate, appointmentToEdit }: NewAppointmentModalProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  const { addAppointmentOptimistic, updateAppointmentOptimistic, removeAppointmentOptimistic } = useCalendarStore();

  const [loading, setLoading] = useState(false);
  const [isTask, setIsTask] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Geral');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<{id: string, name: string, phone: string} | null>(null);
  const [leadSuggestions, setLeadSuggestions] = useState<any[]>([]);
  
  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceCount, setRecurrenceCount] = useState(1);

  // Notification State
  const [sendNotifications, setSendNotifications] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]); 
  const [showNotificationConfig, setShowNotificationConfig] = useState(false);

  // Reset or Load Data
  useEffect(() => {
      if (isOpen) {
          if (appointmentToEdit) {
              // EDIT MODE
              setTitle(appointmentToEdit.title);
              setDescription(appointmentToEdit.description || '');
              const start = new Date(appointmentToEdit.start_time);
              const end = new Date(appointmentToEdit.end_time);
              setDate(start.toISOString().split('T')[0]);
              setStartTime(start.toTimeString().slice(0, 5));
              setEndTime(end.toTimeString().slice(0, 5));
              setCategory(appointmentToEdit.category || 'Geral');
              setIsTask(appointmentToEdit.is_task || false);
              if (appointmentToEdit.lead) {
                  setSelectedLead(appointmentToEdit.lead as any);
              }
              // Carrega configs de notificação
              setSendNotifications(appointmentToEdit.send_notifications !== false); // Default true se undefined
              setCustomTemplates((appointmentToEdit as any).custom_notification_config?.lead_notifications || []);
              
              setIsRecurring(false);
          } else {
              // CREATE MODE
              setTitle('');
              setDescription('');
              setDate(preSelectedDate ? preSelectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
              setStartTime('09:00');
              setEndTime('10:00');
              setCategory('Geral');
              setIsTask(false);
              setSelectedLead(null);
              setIsRecurring(false);
              setRecurrenceCount(1);
              setSendNotifications(true); // Default ON
              setCustomTemplates([]);
          }
          setLeadSearch('');
          setLeadSuggestions([]);
          setShowNotificationConfig(false);
      }
  }, [isOpen, preSelectedDate, appointmentToEdit]);

  const handleSearchLead = async (query: string) => {
      setLeadSearch(query);
      if (query.length < 3 || !user?.company_id) {
          setLeadSuggestions([]);
          return;
      }
      const { data } = await supabase.from('leads')
        .select('id, name, phone')
        .eq('company_id', user.company_id)
        .ilike('name', `%${query}%`)
        .limit(5);
      setLeadSuggestions(data || []);
  };

  const addCustomTemplate = () => {
      const newTemplate = {
          id: Date.now().toString(),
          type: 'before_event',
          time_amount: 1,
          time_unit: 'hours',
          template: 'Olá [lead_name], lembrete do nosso compromisso em 1h.',
          active: true
      };
      setCustomTemplates([...customTemplates, newTemplate]);
  };

  const updateCustomTemplate = (id: string, field: string, value: any) => {
      setCustomTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeCustomTemplate = (id: string) => {
      setCustomTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleSave = async () => {
      if (!title.trim() || !date || !startTime || !endTime) {
          addToast({ type: 'warning', title: 'Campos obrigatórios', message: 'Preencha título, data e horários.' });
          return;
      }
      if (!user?.id || !user?.company_id) return;

      setLoading(true);
      try {
          const startISO = `${date}T${startTime}:00`;
          const endISO = `${date}T${endTime}:00`;
          
          // Configuração de Notificação
          // Se tiver templates customizados, cria o objeto de config. Senão, vai null (usa global)
          let customConfig = null;
          if (customTemplates.length > 0) {
              customConfig = {
                  lead_notifications: customTemplates
                  // Admin notifications herda da global ou fica vazio aqui
              };
          }

          const payload = {
              company_id: user.company_id, 
              user_id: user.id,
              title: title,
              description: description,
              start_time: startISO,
              end_time: endISO,
              category: category,
              is_task: isTask,
              lead_id: selectedLead?.id || null,
              status: 'confirmed',
              origin: 'internal',
              send_notifications: sendNotifications,
              custom_notification_config: customConfig
          };

          if (appointmentToEdit) {
              // UPDATE
              const { data, error } = await supabase
                  .from('appointments')
                  .update(payload)
                  .eq('id', appointmentToEdit.id)
                  .select()
                  .single();
              
              if (error) throw error;
              
              const updatedApp = { ...data, lead: selectedLead } as Appointment;
              updateAppointmentOptimistic(updatedApp);
              addToast({ type: 'success', title: 'Atualizado', message: 'Evento salvo.' });

          } else {
              // CREATE
              const recurrenceRule = isRecurring ? { frequency: recurrenceFreq, count: recurrenceCount } : null;
              
              const appointmentsToCreate = [];
              let currentDate = new Date(startISO);
              let currentEnd = new Date(endISO);
              const iterations = isRecurring ? recurrenceCount : 1;

              for (let i = 0; i < iterations; i++) {
                  appointmentsToCreate.push({
                      ...payload,
                      start_time: currentDate.toISOString(),
                      end_time: currentEnd.toISOString(),
                      recurrence_rule: recurrenceRule,
                      reminder_sent: false,
                      confirmation_sent: false
                  });

                  if (isRecurring) {
                      if (recurrenceFreq === 'daily') {
                          currentDate.setDate(currentDate.getDate() + 1);
                          currentEnd.setDate(currentEnd.getDate() + 1);
                      } else if (recurrenceFreq === 'weekly') {
                          currentDate.setDate(currentDate.getDate() + 7);
                          currentEnd.setDate(currentEnd.getDate() + 7);
                      } else if (recurrenceFreq === 'monthly') {
                          currentDate.setMonth(currentDate.getMonth() + 1);
                          currentEnd.setMonth(currentEnd.getMonth() + 1);
                      }
                  }
              }

              const { data, error } = await supabase.from('appointments').insert(appointmentsToCreate).select();
              if (error) throw error;

              if (selectedLead?.id && data && data.length > 0) {
                  const typeLabel = isTask ? 'Tarefa' : 'Reunião';
                  const logContent = `${typeLabel} agendada: "${title}" para ${new Date(startISO).toLocaleDateString()} às ${startTime}.`;
                  
                  await supabase.from('lead_activities').insert({
                      company_id: user.company_id,
                      lead_id: selectedLead.id,
                      type: 'log',
                      content: logContent,
                      created_by: user.id
                  });

                  // Trigger de confirmação imediata (Se habilitado)
                  if (!isTask && sendNotifications) {
                      api.post('/appointments/confirm', { 
                          appointmentId: data[0].id, 
                          companyId: user.company_id 
                      }).catch(err => console.error("Erro ao enviar confirmação:", err));
                  }
              }

              if (data && data.length > 0) {
                  const newApp = { ...data[0], lead: selectedLead } as Appointment;
                  addAppointmentOptimistic(newApp);
              }
              addToast({ type: 'success', title: 'Criado', message: isRecurring ? `${iterations} eventos criados.` : 'Evento criado.' });
          }

          onClose();

      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async () => {
      if (!appointmentToEdit) return;
      if (!confirm("Tem certeza que deseja excluir este evento?")) return;
      
      setLoading(true);
      try {
          const { error } = await supabase.from('appointments').delete().eq('id', appointmentToEdit.id);
          if (error) throw error;
          
          removeAppointmentOptimistic(appointmentToEdit.id);
          addToast({ type: 'success', title: 'Excluído', message: 'Evento removido.' });
          onClose();
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={appointmentToEdit ? "Editar Evento" : (isTask ? "Nova Tarefa" : "Novo Compromisso")} maxWidth="md">
        <div className="space-y-6">
            
            {!appointmentToEdit && (
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button onClick={() => setIsTask(false)} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors", !isTask ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>Evento / Reunião</button>
                    <button onClick={() => setIsTask(true)} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors", isTask ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}>Tarefa (Checklist)</button>
                </div>
            )}

            <div className="space-y-3">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Título</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={isTask ? "Ex: Enviar proposta" : "Ex: Reunião com Cliente"} className="mt-1" autoFocus />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Descrição</label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes..." className="mt-1 h-20" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><Calendar size={12} /> Data</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><Clock size={12} /> Início</label>
                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><Clock size={12} /> Fim</label>
                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1" />
                </div>
            </div>

            {!appointmentToEdit && (
                <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                            <Repeat size={14} className="text-purple-500" /> Repetir Evento
                        </label>
                        <div onClick={() => setIsRecurring(!isRecurring)} className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", isRecurring ? "bg-purple-600" : "bg-zinc-700")}>
                            <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", isRecurring ? "left-4.5" : "left-0.5")} />
                        </div>
                    </div>
                    {isRecurring && (
                        <div className="mt-3 grid grid-cols-2 gap-3 animate-in slide-in-from-top-1">
                            <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Frequência</span>
                                <select value={recurrenceFreq} onChange={e => setRecurrenceFreq(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white">
                                    <option value="daily">Diariamente</option>
                                    <option value="weekly">Semanalmente</option>
                                    <option value="monthly">Mensalmente</option>
                                </select>
                            </div>
                            <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">Repetir por (vezes)</span>
                                <Input type="number" min="1" max="52" value={recurrenceCount} onChange={e => setRecurrenceCount(Number(e.target.value))} className="h-7 text-xs" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1 mb-1"><Tag size={12} /> Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md h-10 px-3 text-sm text-white">
                        <option value="Geral">Geral</option>
                        <option value="Reunião">Reunião</option>
                        <option value="Visita">Visita</option>
                        <option value="Ligação">Ligação</option>
                        <option value="Pessoal">Pessoal</option>
                    </select>
                </div>
                <div className="relative">
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1 mb-1"><User size={12} /> Vincular Lead</label>
                    {selectedLead ? (
                        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-md px-3 h-10">
                            <span className="text-sm text-blue-400 truncate">{selectedLead.name}</span>
                            <button onClick={() => setSelectedLead(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                        </div>
                    ) : (
                        <>
                            <Input value={leadSearch} onChange={e => handleSearchLead(e.target.value)} placeholder="Buscar nome..." className="h-10" />
                            {leadSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                                    {leadSuggestions.map(lead => (
                                        <div key={lead.id} onClick={() => { setSelectedLead(lead); setLeadSearch(''); setLeadSuggestions([]); }} className="px-3 py-2 hover:bg-zinc-800 cursor-pointer text-sm text-zinc-300">
                                            {lead.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {/* NOTIFICATION TOGGLE & CONFIG */}
            {!isTask && (
                <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                                <Bell size={14} className={sendNotifications ? "text-yellow-500" : "text-zinc-600"} /> 
                                Enviar Avisos
                            </label>
                            {sendNotifications && selectedLead && (
                                <span className="text-[10px] text-zinc-500 mt-1">
                                    Enviaremos lembretes para {selectedLead.name}
                                </span>
                            )}
                        </div>
                        <div onClick={() => setSendNotifications(!sendNotifications)} className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", sendNotifications ? "bg-yellow-600" : "bg-zinc-700")}>
                            <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", sendNotifications ? "left-4.5" : "left-0.5")} />
                        </div>
                    </div>
                    
                    {sendNotifications && (
                        <div className="mt-3">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowNotificationConfig(!showNotificationConfig)} 
                                className="w-full text-xs h-6 text-zinc-500 hover:text-white"
                            >
                                {showNotificationConfig ? 'Ocultar Configuração' : 'Personalizar Mensagens'}
                            </Button>
                            
                            {showNotificationConfig && (
                                <div className="space-y-3 mt-2 animate-in fade-in pt-2 border-t border-zinc-800">
                                    <p className="text-[10px] text-zinc-500 italic">Se vazio, usa os modelos padrão das Configurações.</p>
                                    
                                    {customTemplates.map((tpl, idx) => (
                                        <div key={tpl.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 relative">
                                            <div className="flex gap-2 mb-1">
                                                <Input type="number" value={tpl.time_amount} onChange={e => updateCustomTemplate(tpl.id, 'time_amount', e.target.value)} className="w-12 h-6 text-xs" />
                                                <select value={tpl.time_unit} onChange={e => updateCustomTemplate(tpl.id, 'time_unit', e.target.value)} className="bg-zinc-900 text-xs rounded border-zinc-700 h-6">
                                                    <option value="minutes">Min</option>
                                                    <option value="hours">Horas</option>
                                                </select>
                                                <span className="text-xs text-zinc-500 pt-1">antes</span>
                                            </div>
                                            <Textarea value={tpl.template} onChange={e => updateCustomTemplate(tpl.id, 'template', e.target.value)} className="h-12 text-xs bg-zinc-900 border-zinc-800" />
                                            <button onClick={() => removeCustomTemplate(tpl.id)} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500"><X size={12}/></button>
                                        </div>
                                    ))}
                                    
                                    <Button size="sm" variant="outline" onClick={addCustomTemplate} className="w-full h-7 text-xs border-dashed border-zinc-700 text-zinc-500">
                                        + Adicionar Lembrete
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!selectedLead && sendNotifications && (
                        <div className="mt-2 text-xs text-red-400 flex items-center gap-1 bg-red-500/10 p-1.5 rounded">
                            <AlertCircle size={12} /> Vincule um Lead para enviar avisos.
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between pt-4 border-t border-zinc-800">
                {appointmentToEdit ? (
                    <Button variant="destructive" onClick={handleDelete} isLoading={loading} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </Button>
                ) : <div />}
                
                <Button onClick={handleSave} isLoading={loading} className="bg-primary hover:bg-primary/90 text-white">
                    <Save className="w-4 h-4 mr-2" /> {appointmentToEdit ? 'Atualizar' : `Criar ${isTask ? 'Tarefa' : 'Evento'}`}
                </Button>
            </div>
        </div>
    </Modal>
  );
}
