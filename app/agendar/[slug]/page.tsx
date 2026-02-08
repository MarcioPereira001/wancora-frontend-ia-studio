
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicRule, getBusySlots, bookAppointment } from '@/app/actions/public-calendar';
import { generateSlots } from '@/utils/calendar';
import { 
    Calendar as CalendarIcon, Clock, CheckCircle2, User, 
    Phone, Mail, FileText, ChevronLeft, ChevronRight, Loader2, 
    ArrowRight, MapPin 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';

export default function PublicSchedulePage() {
  const params = useParams();
  const { addToast } = useToast();
  const slug = params.slug as string;

  const [rule, setRule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Fluxo: 0=Date, 1=Time, 2=Form, 3=Success
  const [step, setStep] = useState(0);
  
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
              
              // Verifica se o dia da semana é permitido
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
          setStep(1); // Auto advance to Time selection on mobile UX
      }
  }, [selectedDate, rule]);

  // Máscara de Telefone BR
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 11) val = val.substring(0, 11);
      
      let formatted = val;
      if (val.length > 2) {
          formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
      }
      if (val.length > 7) {
          formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
      }
      
      setFormData({ ...formData, phone: formatted });
  };

  const handleBooking = async () => {
      if (!selectedDate || !selectedTime) return;
      
      if (!formData.name.trim()) {
          addToast({ type: 'warning', title: 'Nome Obrigatório', message: 'Por favor, informe seu nome.' });
          return;
      }
      // Validação de telefone mínima (DDD + 8 dígitos)
      const rawPhone = formData.phone.replace(/\D/g, '');
      if (rawPhone.length < 10) {
          addToast({ type: 'warning', title: 'Telefone Inválido', message: 'Digite um número de WhatsApp válido com DDD.' });
          return;
      }

      setBookingLoading(true);

      // --- CORREÇÃO DE TIMEZONE ---
      const localDateTimeStr = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`;
      const localDateObj = new Date(localDateTimeStr);

      const utcYear = localDateObj.getUTCFullYear();
      const utcMonth = String(localDateObj.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(localDateObj.getUTCDate()).padStart(2, '0');
      const utcHours = String(localDateObj.getUTCHours()).padStart(2, '0');
      const utcMinutes = String(localDateObj.getUTCMinutes()).padStart(2, '0');

      const dateToSend = `${utcYear}-${utcMonth}-${utcDay}`;
      const timeToSend = `${utcHours}:${utcMinutes}`;

      const result = await bookAppointment({
          slug,
          date: dateToSend,
          time: timeToSend,
          ...formData
      });

      setBookingLoading(false);

      if (result.error) {
          addToast({ type: 'error', title: 'Erro', message: result.error });
      } else {
          setStep(3); // Success
      }
  };

  const renderCalendar = () => {
      const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });
      const days = [];
      let day = startDate;

      for (let i = 0; i < 35; i++) {
          const cloneDay = day;
          const isMonthMatch = isSameMonth(cloneDay, currentMonth);
          const isSelected = selectedDate ? isSameDay(cloneDay, selectedDate) : false;
          const isToday = isSameDay(cloneDay, new Date());
          const isAvailableDay = rule?.days_of_week?.includes(cloneDay.getDay());
          const isPast = cloneDay < new Date(new Date().setHours(0,0,0,0));
          const isDisabled = !isAvailableDay || isPast;

          days.push(
              <button
                  key={i}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setSelectedDate(cloneDay)}
                  className={cn(
                      "h-10 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all relative",
                      !isMonthMatch && "text-zinc-700 opacity-50",
                      isDisabled && "text-zinc-700 cursor-not-allowed opacity-30",
                      !isDisabled && !isSelected && "text-zinc-300 hover:bg-zinc-800 hover:text-white",
                      isSelected && "bg-primary text-black font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-110 z-10",
                      isToday && !isSelected && "border border-primary/50 text-primary"
                  )}
              >
                  {format(cloneDay, 'd')}
              </button>
          );
          day = addDays(day, 1);
      }
      return days;
  };

  // --- LOADING SCREEN ---
  if (loading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-zinc-500 animate-pulse text-sm">Carregando agenda...</p>
          </div>
      );
  }

  // --- 404 SCREEN ---
  if (!rule) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-6 p-6 text-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-2xl">
                  <CalendarIcon className="w-10 h-10 opacity-50" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Agenda não encontrada</h1>
                <p className="text-sm max-w-xs mx-auto">O link pode estar expirado ou incorreto. Verifique com a empresa.</p>
              </div>
          </div>
      );
  }

  const progress = ((step) / 3) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:items-center md:justify-center p-0 md:p-6 font-sans">
      
      {/* Progress Bar (Mobile) */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-900 z-50 md:hidden">
          <motion.div 
            className="h-full bg-primary" 
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            transition={{ duration: 0.5 }}
          />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl bg-[#09090b] md:border border-zinc-800 md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:min-h-[600px] h-[100dvh] md:h-auto relative"
      >
        
        {/* --- SIDEBAR (INFO) --- */}
        <div className="w-full md:w-[35%] bg-zinc-900/60 p-6 md:p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between shrink-0 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-20"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

            <div>
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                        {rule.owner_avatar ? (
                            <img src={rule.owner_avatar} className="w-14 h-14 rounded-full border-2 border-zinc-800 object-cover" alt="Avatar" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-500 font-bold text-lg">
                                {(rule.company_name || 'C').charAt(0)}
                            </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{rule.company_name}</p>
                        <h3 className="text-base font-bold text-white">{rule.owner_name || 'Consultor'}</h3>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-6 leading-tight">{rule.name}</h1>
                
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-zinc-400 text-sm bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="font-medium">{rule.slot_duration} min</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400 text-sm bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                        <MapPin className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">Google Meet / Online</span>
                    </div>
                </div>
            </div>

            {/* Resumo do Agendamento (Fixo na sidebar em desktop) */}
            <AnimatePresence>
            {selectedDate && selectedTime && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-8 pt-6 border-t border-zinc-800"
                >
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Resumo</p>
                    <div className="text-zinc-200">
                        <div className="text-lg font-bold capitalize text-primary">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</div>
                        <div className="text-3xl font-mono font-bold">{selectedTime}</div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>

        {/* --- MAIN CONTENT (STEPS) --- */}
        <div className="flex-1 relative bg-black/20 flex flex-col h-full overflow-hidden">
            
            {/* Header Mobile com Botão Voltar */}
            {step > 0 && step < 3 && (
                <div className="md:hidden flex items-center p-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur z-20 sticky top-0">
                    <button onClick={() => setStep(step - 1)} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-sm ml-2">
                        {step === 1 ? 'Escolher Horário' : 'Seus Dados'}
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
            <AnimatePresence mode="wait">
                
                {/* STEP 0: CALENDAR */}
                {step === 0 && (
                    <motion.div 
                        key="step0"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-full flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-zinc-500" />
                                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                            </h2>
                            <div className="flex gap-2 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                                <button onClick={() => setCurrentMonth(subWeeks(currentMonth, 4))} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button onClick={() => setCurrentMonth(addWeeks(currentMonth, 4))} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center mb-2">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                <div key={d} className="text-xs font-bold text-zinc-500 uppercase">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                            {renderCalendar()}
                        </div>
                        
                        <div className="mt-8 text-center text-xs text-zinc-600">
                            Fuso Horário: Horário Padrão de Brasília
                        </div>
                    </motion.div>
                )}

                {/* STEP 1: TIME SLOTS */}
                {step === 1 && (
                    <motion.div 
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-full flex flex-col"
                    >
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Horários Disponíveis
                        </h2>
                        
                        {loadingSlots ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                                <Loader2 className="w-10 h-10 text-zinc-600 animate-spin" />
                                <span className="text-zinc-500 text-sm">Buscando disponibilidade...</span>
                            </div>
                        ) : slots.length === 0 ? (
                            <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-zinc-800 border-dashed">
                                <p className="text-zinc-400">Nenhum horário disponível para esta data.</p>
                                <Button variant="link" onClick={() => setStep(0)} className="text-primary mt-2">Escolher outra data</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.time}
                                        disabled={!slot.available}
                                        onClick={() => { setSelectedTime(slot.time); setStep(2); }}
                                        className={cn(
                                            "py-3 rounded-xl text-sm font-bold font-mono border transition-all duration-200 active:scale-95",
                                            slot.available 
                                                ? "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 hover:text-white hover:shadow-lg hover:shadow-primary/5"
                                                : "bg-zinc-950/30 border-transparent text-zinc-700 cursor-not-allowed line-through opacity-50"
                                        )}
                                    >
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        <div className="mt-auto pt-8 flex justify-start md:hidden">
                             {/* Espaço para footer se necessário */}
                        </div>
                    </motion.div>
                )}

                {/* STEP 2: FORM */}
                {step === 2 && (
                    <motion.div 
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6 max-w-md mx-auto"
                    >
                         <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Seus Dados
                        </h2>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                                    <Input 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        className="pl-10 bg-zinc-900 border-zinc-800 h-12 text-base rounded-xl focus:ring-primary/50" 
                                        placeholder="Seu nome" 
                                        autoFocus 
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                                    <Input 
                                        value={formData.phone} 
                                        onChange={handlePhoneChange} 
                                        className="pl-10 bg-zinc-900 border-zinc-800 h-12 text-base rounded-xl focus:ring-primary/50" 
                                        placeholder="(99) 99999-9999" 
                                        maxLength={15}
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-500 ml-1">Receberá a confirmação neste número.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email (Opcional)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                                    <Input 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        className="pl-10 bg-zinc-900 border-zinc-800 h-12 text-base rounded-xl focus:ring-primary/50" 
                                        placeholder="seu@email.com" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Observações</label>
                                <Textarea 
                                    value={formData.notes} 
                                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                                    className="bg-zinc-900 border-zinc-800 min-h-[100px] rounded-xl focus:ring-primary/50 p-3" 
                                    placeholder="Algum detalhe específico para a reunião?" 
                                />
                            </div>

                            <Button 
                                onClick={handleBooking} 
                                disabled={bookingLoading} 
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl text-base shadow-[0_0_25px_rgba(34,197,94,0.3)] mt-4 transition-all active:scale-95"
                            >
                                {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Agendamento'}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 3 && (
                    <motion.div 
                        key="step3"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center p-4"
                    >
                        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/30 shadow-[0_0_60px_rgba(34,197,94,0.4)] animate-in zoom-in duration-500">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        
                        <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">Agendado!</h2>
                        
                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 max-w-sm w-full mb-8">
                            <p className="text-zinc-400 text-sm mb-1">Sua reunião foi confirmada para</p>
                            <p className="text-xl font-bold text-white capitalize">{format(selectedDate!, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                            <div className="text-3xl font-mono font-bold text-primary mt-2">{selectedTime}</div>
                        </div>

                        <p className="text-zinc-500 text-sm max-w-xs mb-8">
                            Enviamos os detalhes para o seu WhatsApp.
                        </p>
                        
                        <Button variant="outline" onClick={() => window.location.reload()} className="border-zinc-700 bg-transparent hover:bg-zinc-800 rounded-xl">
                            Fazer novo agendamento
                        </Button>
                    </motion.div>
                )}

            </AnimatePresence>
            </div>
        </div>

      </motion.div>
      
      {/* Branding Footer */}
      <div className="mt-8 text-center opacity-40 hover:opacity-100 transition-opacity">
          <a href="https://wancora.com.br" target="_blank" className="flex items-center justify-center gap-2 text-xs font-medium text-zinc-500">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Powered by Wancora CRM
          </a>
      </div>
    </div>
  );
}
