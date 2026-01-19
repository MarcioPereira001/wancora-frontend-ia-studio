
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicRule, getBusySlots, bookAppointment } from '@/app/actions/public-calendar';
import { generateSlots } from '@/utils/calendar';
import { Calendar as CalendarIcon, Clock, CheckCircle2, User, Phone, Mail, FileText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/useToast';

export default function PublicSchedulePage() {
  const params = useParams();
  const { addToast } = useToast();
  const slug = params.slug as string;

  const [rule, setRule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'date' | 'form' | 'success'>('date');
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      email: '',
      notes: ''
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  // Fetch Rule Initial
  useEffect(() => {
      const fetchRule = async () => {
          const data = await getPublicRule(slug);
          if (data) setRule(data);
          setLoading(false);
      };
      fetchRule();
  }, [slug]);

  // Fetch Slots when Date Selected
  useEffect(() => {
      if (selectedDate && rule) {
          const fetchSlots = async () => {
              setLoadingSlots(true);
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              
              const dayOfWeek = selectedDate.getDay();
              
              if (!rule.days_of_week.includes(dayOfWeek)) {
                  setSlots([]);
                  setLoadingSlots(false);
                  return;
              }

              const busy = await getBusySlots(rule.rule_id, dateStr);
              const generated = generateSlots(dateStr, rule, busy);
              setSlots(generated);
              setLoadingSlots(false);
          };
          fetchSlots();
          setSelectedTime(null);
      }
  }, [selectedDate, rule]);

  const handleBooking = async () => {
      if (!selectedDate || !selectedTime) return;
      if (!formData.name || !formData.phone) {
          addToast({ type: 'warning', title: 'Campos Obrigatórios', message: 'Preencha nome e WhatsApp.' });
          return;
      }

      setBookingLoading(true);

      // --- CORREÇÃO DE TIMEZONE ---
      // O Banco (RPC) espera strings de data/hora e as combina em UTC.
      // Se enviarmos '2023-10-25' e '00:15' (Local), o banco salva '00:15 UTC' (que é 21:15 do dia anterior no Brasil).
      // Precisamos converter a escolha do usuário para UTC antes de enviar.
      
      // 1. Criar objeto Date representando o momento exato no navegador do usuário
      const localDateTimeStr = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`;
      const localDateObj = new Date(localDateTimeStr);

      // 2. Extrair componentes UTC desse momento
      const utcYear = localDateObj.getUTCFullYear();
      const utcMonth = String(localDateObj.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(localDateObj.getUTCDate()).padStart(2, '0');
      const utcHours = String(localDateObj.getUTCHours()).padStart(2, '0');
      const utcMinutes = String(localDateObj.getUTCMinutes()).padStart(2, '0');

      // 3. Montar strings UTC para enviar à RPC
      const dateToSend = `${utcYear}-${utcMonth}-${utcDay}`;
      const timeToSend = `${utcHours}:${utcMinutes}`;

      const result = await bookAppointment({
          slug,
          date: dateToSend, // Envia data em UTC
          time: timeToSend, // Envia hora em UTC
          ...formData
      });

      setBookingLoading(false);

      if (result.error) {
          addToast({ type: 'error', title: 'Erro', message: result.error });
      } else {
          setStep('success');
      }
  };

  const renderCalendar = () => {
      const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });
      const days = [];
      let day = startDate;

      for (let i = 0; i < 35; i++) {
          const cloneDay = day;
          const isSameMonth = cloneDay.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDate ? isSameDay(cloneDay, selectedDate) : false;
          const isToday = isSameDay(cloneDay, new Date());
          const isAvailableDay = rule?.days_of_week?.includes(cloneDay.getDay());
          const isPast = cloneDay < new Date(new Date().setHours(0,0,0,0));

          days.push(
              <button
                  key={i}
                  disabled={!isAvailableDay || isPast}
                  onClick={() => setSelectedDate(cloneDay)}
                  className={cn(
                      "h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all relative",
                      !isSameMonth && "text-zinc-700",
                      isSameMonth && !isAvailableDay && "text-zinc-700 cursor-not-allowed",
                      isSameMonth && isAvailableDay && !isPast && "text-zinc-300 hover:bg-zinc-800",
                      isPast && "text-zinc-700 cursor-not-allowed opacity-50",
                      isSelected && "bg-primary text-primary-foreground shadow-lg shadow-green-500/20 font-bold",
                      isToday && !isSelected && "border border-primary/50 text-primary"
                  )}
              >
                  {format(cloneDay, 'd')}
                  {isSelected && <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />}
              </button>
          );
          day = addDays(day, 1);
      }
      return days;
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
      );
  }

  if (!rule) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                  <CalendarIcon className="w-8 h-8 opacity-50" />
              </div>
              <h1 className="text-xl font-bold text-white">Agenda não encontrada</h1>
              <p>Verifique o link ou entre em contato com a empresa.</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        <div className="w-full md:w-1/3 bg-zinc-900 p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col">
            <div className="flex items-center gap-4 mb-8">
                {rule.owner_avatar ? (
                    <img src={rule.owner_avatar} className="w-12 h-12 rounded-full border-2 border-zinc-800" alt="Avatar" />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                        <User className="w-6 h-6 text-zinc-500" />
                    </div>
                )}
                <div>
                    <p className="text-xs text-zinc-500 font-bold uppercase">{rule.company_name}</p>
                    <h3 className="text-sm font-bold text-white">{rule.owner_name || 'Consultor'}</h3>
                </div>
            </div>

            <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-4">{rule.name}</h1>
                <div className="space-y-3 text-zinc-400 text-sm">
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{rule.slot_duration} min</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /></div>
                        <span>Disponível Online</span>
                    </div>
                </div>
            </div>

            {selectedDate && selectedTime && step === 'date' && (
                <div className="mt-8 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 animate-in slide-in-from-bottom-4">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Selecionado</p>
                    <p className="text-lg font-bold text-white capitalize">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                    <p className="text-xl font-mono text-primary mt-1">{selectedTime}</p>
                    <Button onClick={() => setStep('form')} className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                        Confirmar Horário
                    </Button>
                </div>
            )}
        </div>

        <div className="flex-1 p-6 md:p-8 bg-black/20">
            {step === 'success' ? (
                <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Agendado!</h2>
                    <p className="text-zinc-400 max-w-xs mb-8">
                        Sua reunião foi confirmada para<br/>
                        <strong className="text-white">{format(selectedDate!, "d 'de' MMMM", { locale: ptBR })} às {selectedTime}</strong>.
                    </p>
                    <Button variant="outline" onClick={() => window.location.reload()}>Fazer outro agendamento</Button>
                </div>
            ) : step === 'form' ? (
                <div className="max-w-md mx-auto animate-in slide-in-from-right-4">
                    <button onClick={() => setStep('date')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Voltar para o calendário
                    </button>
                    
                    <h2 className="text-xl font-bold text-white mb-6">Seus Dados</h2>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="pl-9 bg-zinc-900 border-zinc-800 h-10" placeholder="Seu nome" autoFocus />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="pl-9 bg-zinc-900 border-zinc-800 h-10" placeholder="(99) 99999-9999" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Email (Opcional)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-9 bg-zinc-900 border-zinc-800 h-10" placeholder="seu@email.com" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Observações</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="pl-9 bg-zinc-900 border-zinc-800 min-h-[100px]" placeholder="Algum detalhe para a reunião?" />
                            </div>
                        </div>

                        <Button onClick={handleBooking} disabled={bookingLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 mt-4">
                            {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Agendamento'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col animate-in fade-in">
                    {/* Header Calendário */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-white capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                        </h2>
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subWeeks(currentMonth, 4))} className="h-8 w-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addWeeks(currentMonth, 4))} className="h-8 w-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Grid Dias */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                            <div key={d} className="text-center text-xs font-bold text-zinc-500 uppercase py-2">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {renderCalendar()}
                    </div>

                    {/* Slots List */}
                    <div className="mt-8 border-t border-zinc-800 pt-6 flex-1">
                        <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center justify-between">
                            <span>Horários Disponíveis</span>
                            {selectedDate && <span className="text-xs font-normal text-zinc-500 capitalize">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>}
                        </h3>
                        
                        {!selectedDate ? (
                            <div className="text-center text-zinc-600 text-sm py-8">Selecione um dia para ver os horários.</div>
                        ) : loadingSlots ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        ) : slots.length === 0 ? (
                            <div className="text-center text-zinc-500 text-sm py-8 bg-zinc-900/50 rounded-lg border border-dashed border-zinc-800">
                                Nenhum horário disponível neste dia.
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.time}
                                        disabled={!slot.available}
                                        onClick={() => setSelectedTime(slot.time)}
                                        className={cn(
                                            "py-2 rounded-lg text-sm font-mono border transition-all",
                                            slot.available 
                                                ? selectedTime === slot.time 
                                                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
                                                : "bg-zinc-950/50 border-transparent text-zinc-700 cursor-not-allowed decoration-zinc-800 line-through"
                                        )}
                                    >
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
