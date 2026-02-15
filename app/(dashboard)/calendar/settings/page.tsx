
'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRealtimeStore } from '@/store/useRealtimeStore'; 
import { useToast } from '@/hooks/useToast';
import { getMyAvailability, saveAvailabilityRules, type AvailabilityFormData } from '@/app/actions/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, Globe, Save, Loader2, Copy, Bell, MessageSquare, Plus, Trash2, Send, Smartphone, MapPin, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { api } from '@/services/api';

const WEEKDAYS = [
  { id: 0, label: 'D', name: 'Domingo' },
  { id: 1, label: 'S', name: 'Segunda' },
  { id: 2, label: 'T', name: 'Terça' },
  { id: 3, label: 'Q', name: 'Quarta' },
  { id: 4, label: 'Q', name: 'Quinta' },
  { id: 5, label: 'S', name: 'Sexta' },
  { id: 6, label: 'S', name: 'Sábado' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function CalendarSettingsPage() {
  const { user } = useAuthStore();
  const { instances } = useRealtimeStore(); 
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'notifications'>('general');
  
  // Data State
  const [formData, setFormData] = useState<AvailabilityFormData>({
    name: 'Minha Agenda',
    slug: '',
    days_of_week: [1, 2, 3, 4, 5],
    start_hour: '09:00',
    end_hour: '18:00',
    slot_duration: 30,
    is_active: true,
    event_goal: 'Reunião',
    event_location_type: 'online',
    event_location_details: 'Google Meet'
  });

  // Notification State
  const [notifConfig, setNotifConfig] = useState<any>({
      sending_session_id: '',
      admin_phone: '',
      admin_notifications: [],
      lead_notifications: []
  });

  const [adminSearch, setAdminSearch] = useState('');
  const [adminSuggestions, setAdminSuggestions] = useState<any[]>([]);

  // Load Data
  useEffect(() => {
    const init = async () => {
        const data = await getMyAvailability();
        if (data) {
            setFormData({
                id: data.id,
                name: data.name,
                slug: data.slug,
                days_of_week: data.days_of_week || [],
                start_hour: data.start_hour ? data.start_hour.slice(0, 5) : '09:00',
                end_hour: data.end_hour ? data.end_hour.slice(0, 5) : '18:00',
                slot_duration: data.slot_duration,
                is_active: data.is_active,
                event_goal: data.event_goal || 'Reunião',
                event_location_type: data.event_location_type || 'online',
                event_location_details: data.event_location_details || 'Google Meet'
            });
            // Load Notifications
            if (data.notification_config) {
                setNotifConfig({
                    ...data.notification_config,
                    // Garante fallback se estiver vazio
                    sending_session_id: data.notification_config.sending_session_id || '' 
                });
                setAdminSearch(data.notification_config.admin_phone || '');
            } else {
                setNotifConfig({
                    sending_session_id: '',
                    admin_phone: '',
                    admin_notifications: [{ 
                        id: 'default-1', type: 'on_booking', active: true, 
                        template: "Novo Agendamento Para [empresa]! Nome: [lead_name], Contato: [lead_phone]. Confira se está tudo certo, boa reunião!" 
                    }],
                    lead_notifications: []
                });
            }
        } else if (user?.name) {
            const suggestedSlug = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-agenda';
            setFormData(prev => ({ ...prev, slug: suggestedSlug }));
        }
        setIsLoading(false);
    };
    init();
  }, [user]);

  const toggleDay = (dayId: number) => {
      setFormData(prev => {
          const exists = prev.days_of_week.includes(dayId);
          if (exists) return { ...prev, days_of_week: prev.days_of_week.filter(d => d !== dayId) };
          return { ...prev, days_of_week: [...prev.days_of_week, dayId].sort() };
      });
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          const payload = { ...formData, notification_config: notifConfig };
          
          const result = await saveAvailabilityRules(payload);
          
          if (result.error) {
              addToast({ type: 'error', title: 'Erro', message: result.error });
          } else {
              addToast({ type: 'success', title: 'Salvo', message: 'Configurações atualizadas.' });
          }
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha de comunicação.' });
      } finally {
          setIsSaving(false);
      }
  };

  const searchAdminContact = async (query: string) => {
      setAdminSearch(query);
      setNotifConfig({...notifConfig, admin_phone: query}); 
      if (query.length < 3 || !user?.company_id) return;
      const { data } = await supabase.from('contacts')
        .select('name, jid')
        .eq('company_id', user.company_id)
        .ilike('name', `%${query}%`)
        .limit(5);
      setAdminSuggestions(data || []);
  };

  const selectAdminContact = (contact: any) => {
      const phone = contact.jid.split('@')[0];
      setNotifConfig({...notifConfig, admin_phone: phone});
      setAdminSearch(phone);
      setAdminSuggestions([]);
  };

  const addNotification = (target: 'admin' | 'lead') => {
      const newTrigger = {
          id: Date.now().toString(),
          type: 'before_event',
          time_amount: 1,
          time_unit: 'hours',
          template: target === 'admin' ? 'Lembrete: Reunião com [lead_name] em 1 hora.' : 'Olá [lead_name], sua reunião com [empresa] é daqui a 1 hora!',
          active: true
      };
      if(target === 'admin') setNotifConfig({...notifConfig, admin_notifications: [...notifConfig.admin_notifications, newTrigger]});
      else setNotifConfig({...notifConfig, lead_notifications: [...notifConfig.lead_notifications, newTrigger]});
  };

  const removeNotification = (target: 'admin' | 'lead', id: string) => {
      if(target === 'admin') setNotifConfig({...notifConfig, admin_notifications: notifConfig.admin_notifications.filter((n:any) => n.id !== id)});
      else setNotifConfig({...notifConfig, lead_notifications: notifConfig.lead_notifications.filter((n:any) => n.id !== id)});
  };

  const updateNotification = (target: 'admin' | 'lead', id: string, field: string, value: any) => {
      const updater = (list: any[]) => list.map(n => n.id === id ? { ...n, [field]: value } : n);
      if(target === 'admin') setNotifConfig({...notifConfig, admin_notifications: updater(notifConfig.admin_notifications)});
      else setNotifConfig({...notifConfig, lead_notifications: updater(notifConfig.lead_notifications)});
  };

  const testNotification = async (phone: string, text: string) => {
      if(!phone || !text) return;
      const activeSession = notifConfig.sending_session_id || instances.find(i => i.status === 'connected')?.session_id || 'default';
      try {
          await api.post('/message/send', {
              sessionId: activeSession, 
              companyId: user?.company_id,
              to: phone,
              type: 'text',
              text: `[TESTE] ${text}`
          });
          addToast({ type: 'success', title: 'Enviado', message: 'Mensagem de teste enviada.' });
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar teste.' });
      }
  };

  if (isLoading) return <div className="flex items-center justify-center h-[calc(100vh-100px)]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const publicUrl = `https://wancora-crm.netlify.app/agendar/${formData.slug}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            Configurar Disponibilidade
            </h1>
            <p className="text-zinc-400 mt-2">Defina horários e automações de avisos.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-green-500/20">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Tudo
        </Button>
      </div>

      <div className="flex border-b border-zinc-800">
          <button onClick={() => setActiveTab('general')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'general' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Geral & Horários
          </button>
          <button onClick={() => setActiveTab('appearance')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'appearance' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Página Pública
          </button>
          <button onClick={() => setActiveTab('notifications')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'notifications' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Automação de Avisos
          </button>
      </div>

      <div className="grid gap-6">
        
        {activeTab === 'general' && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Identidade da Agenda</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome Interno</label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-2">
                                <Globe className="w-3 h-3" /> Link Público
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-2.5 text-zinc-500 text-sm hidden md:block">wancora-crm.netlify.app/agendar/</span>
                                    <Input 
                                        value={formData.slug} 
                                        onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                                        className="md:pl-[240px] bg-zinc-950 border-zinc-800 font-mono text-sm text-primary"
                                    />
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="outline" 
                                    className="border-zinc-800 bg-zinc-900"
                                    onClick={() => { navigator.clipboard.writeText(publicUrl); addToast({ type: 'success', title: 'Copiado', message: 'Link copiado!' }); }}
                                    title="Copiar Link"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 mt-2">
                            <span className="text-sm text-zinc-300 font-medium">Agenda Ativa</span>
                            <button onClick={() => setFormData({...formData, is_active: !formData.is_active})} className={cn("w-11 h-6 rounded-full transition-colors relative", formData.is_active ? "bg-green-600" : "bg-zinc-700")}>
                                <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-transform", formData.is_active ? "left-6" : "left-1")} />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader><CardTitle className="text-lg text-white">Horários</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block">Dias da Semana</label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map((day) => (
                                    <button key={day.id} onClick={() => toggleDay(day.id)} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border", formData.days_of_week.includes(day.id) ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700")}>
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Início</label>
                                <Input type="time" value={formData.start_hour} onChange={e => setFormData({...formData, start_hour: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Fim</label>
                                <Input type="time" value={formData.end_hour} onChange={e => setFormData({...formData, end_hour: e.target.value})} className="bg-zinc-950 border-zinc-800" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Duração (Min)</label>
                            <div className="grid grid-cols-6 gap-2">
                                {DURATIONS.map(min => (
                                    <button key={min} onClick={() => setFormData({...formData, slot_duration: min})} className={cn("px-2 py-2 rounded-md text-xs font-medium border transition-all", formData.slot_duration === min ? "bg-white text-black border-white" : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900")}>{min}</button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* NOVA ABA: APARÊNCIA PÚBLICA */}
        {activeTab === 'appearance' && (
             <div className="space-y-6 animate-in slide-in-from-right-4">
                 <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Informações do Evento</CardTitle>
                        <CardDescription>Estes dados aparecerão no link público de agendamento.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 flex items-center gap-2">
                                <Target className="w-3 h-3" /> Objetivo do Evento
                            </label>
                            <Input 
                                value={formData.event_goal} 
                                onChange={e => setFormData({...formData, event_goal: e.target.value})} 
                                placeholder="Ex: Reunião, Sessão de Terapia, Consulta..."
                                className="bg-zinc-950 border-zinc-800"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Tipo de Local
                            </label>
                            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 mb-2">
                                <button 
                                    onClick={() => setFormData({...formData, event_location_type: 'online'})} 
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors", formData.event_location_type === 'online' ? "bg-zinc-800 text-white shadow" : "text-zinc-500")}
                                >
                                    Online
                                </button>
                                <button 
                                    onClick={() => setFormData({...formData, event_location_type: 'presencial'})} 
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors", formData.event_location_type === 'presencial' ? "bg-zinc-800 text-white shadow" : "text-zinc-500")}
                                >
                                    Presencial
                                </button>
                            </div>
                            
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Detalhes do Local / Plataforma</label>
                            <Input 
                                value={formData.event_location_details} 
                                onChange={e => setFormData({...formData, event_location_details: e.target.value})} 
                                placeholder={formData.event_location_type === 'online' ? "Ex: Google Meet, Zoom..." : "Ex: Escritório Central, Rua X..."}
                                className="bg-zinc-950 border-zinc-800"
                            />
                        </div>
                    </CardContent>
                 </Card>

                 {/* Preview */}
                 <div className="p-4 bg-black/20 rounded-xl border border-zinc-800 flex flex-col items-center text-center opacity-70 hover:opacity-100 transition-opacity">
                     <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Prévia no Link Público</p>
                     <h3 className="text-xl font-bold text-white">{formData.name}</h3>
                     <div className="flex gap-4 mt-2 text-sm text-zinc-400">
                         <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {formData.event_goal}</span>
                         <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {formData.event_location_details}</span>
                     </div>
                 </div>
             </div>
        )}

        {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                
                {/* SELETOR DE INSTÂNCIA - CORRIGIDO */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-green-500" /> Dispositivo de Envio</CardTitle>
                        <CardDescription>Escolha por qual WhatsApp os avisos serão enviados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <select 
                            value={notifConfig.sending_session_id || ''}
                            onChange={e => setNotifConfig({ ...notifConfig, sending_session_id: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="">Automático (Qualquer instância online)</option>
                            {instances.map(inst => (
                                <option key={inst.id} value={inst.session_id}>
                                    {inst.name} ({inst.status === 'connected' ? 'Online' : 'Offline'})
                                </option>
                            ))}
                        </select>
                        {notifConfig.sending_session_id && (
                            <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                                <Save className="w-3 h-3" /> Instância selecionada será salva.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Config Admin */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2"><Bell className="w-5 h-5 text-yellow-500" /> Avisos para Mim (Admin)</CardTitle>
                        <CardDescription>Receba notificações no seu WhatsApp quando agendarem.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="relative">
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Número de Destino (Admin)</label>
                            <Input value={adminSearch} onChange={e => searchAdminContact(e.target.value)} placeholder="5511999999999" className="bg-zinc-950 border-zinc-800 pl-10" />
                            <div className="absolute top-8 left-3 text-zinc-500 text-sm">+</div>
                            {adminSuggestions.length > 0 && (
                                <div className="absolute top-full w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                                    {adminSuggestions.map(c => (
                                        <div key={c.jid} onClick={() => selectAdminContact(c)} className="px-3 py-2 hover:bg-zinc-800 cursor-pointer text-sm text-zinc-300">
                                            {c.name} - {c.jid.split('@')[0]}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {notifConfig.admin_notifications?.map((notif: any, idx: number) => (
                                <div key={notif.id} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 relative group">
                                    <div className="flex gap-2 mb-2">
                                        <select 
                                            value={notif.type} 
                                            onChange={(e) => updateNotification('admin', notif.id, 'type', e.target.value)}
                                            className="bg-zinc-900 border border-zinc-800 rounded text-xs text-white p-1"
                                        >
                                            <option value="on_booking">Ao Agendar</option>
                                            <option value="before_event">Lembrete Antes</option>
                                        </select>
                                        {notif.type === 'before_event' && (
                                            <>
                                                <Input type="number" value={notif.time_amount} onChange={e => updateNotification('admin', notif.id, 'time_amount', e.target.value)} className="w-16 h-7 text-xs bg-zinc-900 border-zinc-800" />
                                                <select value={notif.time_unit} onChange={e => updateNotification('admin', notif.id, 'time_unit', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded text-xs text-white p-1">
                                                    <option value="minutes">Minutos</option>
                                                    <option value="hours">Horas</option>
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <Textarea 
                                        value={notif.template} 
                                        onChange={e => updateNotification('admin', notif.id, 'template', e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-xs min-h-[60px]"
                                        placeholder="Mensagem..."
                                    />
                                    <button onClick={() => removeNotification('admin', notif.id)} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addNotification('admin')} className="w-full border-dashed border-zinc-700 text-zinc-500 text-xs hover:text-white">
                                <Plus className="w-3 h-3 mr-1" /> Adicionar Aviso
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Config Lead */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-500" /> Avisos para o Cliente (Lead)</CardTitle>
                        <CardDescription>Envie confirmações e lembretes automáticos para quem agendou.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            {notifConfig.lead_notifications?.map((notif: any, idx: number) => (
                                <div key={notif.id} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 relative group">
                                    <div className="flex gap-2 mb-2">
                                        <select 
                                            value={notif.type} 
                                            onChange={(e) => updateNotification('lead', notif.id, 'type', e.target.value)}
                                            className="bg-zinc-900 border border-zinc-800 rounded text-xs text-white p-1"
                                        >
                                            <option value="on_booking">Confirmação (Ao Agendar)</option>
                                            <option value="before_event">Lembrete Antes</option>
                                        </select>
                                        {notif.type === 'before_event' && (
                                            <>
                                                <Input type="number" value={notif.time_amount} onChange={e => updateNotification('lead', notif.id, 'time_amount', e.target.value)} className="w-16 h-7 text-xs bg-zinc-900 border-zinc-800" />
                                                <select value={notif.time_unit} onChange={e => updateNotification('lead', notif.id, 'time_unit', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded text-xs text-white p-1">
                                                    <option value="minutes">Minutos</option>
                                                    <option value="hours">Horas</option>
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <Textarea 
                                        value={notif.template} 
                                        onChange={e => updateNotification('lead', notif.id, 'template', e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-xs min-h-[60px]"
                                        placeholder="Mensagem..."
                                    />
                                    <button onClick={() => removeNotification('lead', notif.id)} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addNotification('lead')} className="w-full border-dashed border-zinc-700 text-zinc-500 text-xs hover:text-white">
                                <Plus className="w-3 h-3 mr-1" /> Adicionar Aviso ao Lead
                            </Button>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-300">
                            <strong>Variáveis disponíveis:</strong> [lead_name], [lead_phone], [empresa], [data], [hora].
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

      </div>
    </div>
  );
}
