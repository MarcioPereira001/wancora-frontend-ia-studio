
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getPublicRule, getBusySlots, bookAppointment } from '@/app/actions/public-calendar';
import { generateSlots } from '@/utils/calendar';
import { 
    Calendar as CalendarIcon, Clock, CheckCircle2, User, 
    Phone, Mail, FileText, ChevronLeft, ChevronRight, Loader2, 
    MapPin, ChevronDown, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURAÇÃO DE PAÍSES ---
const COUNTRIES = [
    { code: '55', label: 'Brasil', flag: '🇧🇷', mask: '(99) 99999-9999', limit: 11 },
    { code: '1', label: 'USA/Canada', flag: '🇺🇸', mask: '(999) 999-9999', limit: 10 },
    { code: '351', label: 'Portugal', flag: '🇵🇹', mask: '999 999 999', limit: 9 },
    { code: '44', label: 'UK', flag: '🇬🇧', mask: '9999 999999', limit: 10 },
    { code: '34', label: 'Espanha', flag: '🇪🇸', mask: '999 99 99 99', limit: 9 },
    { code: '54', label: 'Argentina', flag: '🇦🇷', mask: '9 99 9999-9999', limit: 11 },
];

export default function PublicSchedulePage() {
  const params = useParams();
  const { addToast } = useToast();
  const slug = params.slug as string;

  const [rule, setRule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [step, setStep] = useState(0);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [formData, setFormData] = useState({
      name: '',
      email: '',
      notes: ''
  });
  
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default BR
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
              setIsCountryOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      const fetchRule = async () => {
          const data = await getPublicRule(slug);
          if (data) setRule(data);
          setLoading(false);
      };
      fetchRule();
  }, [slug]);

  useEffect(() => {
      if (selectedDate && rule) {
          const fetchSlots = async () => {
              setLoadingSlots(true);
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              const dayOfWeek = selectedDate.getDay();
              
              if (rule.days_of_week && !rule.days_of_week.includes(dayOfWeek)) {
                  setSlots([]);
                  setLoadingSlots(false);
                  return;
              }

              const busy = await getBusySlots(rule.rule_id || rule.id, dateStr);
              const generated = generateSlots(dateStr, rule, busy);
              setSlots(generated);
              setLoadingSlots(false);
          };
          fetchSlots();
          setSelectedTime(null);
          setStep(1); 
      }
  }, [selectedDate, rule]);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '');
      const limit = selectedCountry.limit;
      const val = raw.slice(0, limit);
      
      let formatted = val;
      
      if (selectedCountry.code === '55') {
          if (val.length > 2) formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
          if (val.length > 7) formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
      } 
      else if (limit > 8) {
           if (val.length > 3) formatted = `${val.substring(0, 3)} ${val.substring(3)}`;
           if (val.length > 6) formatted = `${val.substring(0, 3)} ${val.substring(3, 6)} ${val.substring(6)}`;
      }

      setPhoneNumber(formatted);
  };

  const handleBooking = async () => {
      if (!selectedDate || !selectedTime) return;
      
      if (!formData.name.trim()) {
          addToast({ type: 'warning', title: 'Nome Obrigatório', message: 'Como devemos te chamar?' });
          return;
      }
      
      const rawPhone = phoneNumber.replace(/\D/g, '');
      if (rawPhone.length < 5) {
          addToast({ type: 'warning', title: 'Telefone Inválido', message: 'O número parece incompleto.' });
          return;
      }

      setBookingLoading(true);

      const fullPhone = `${selectedCountry.code}${rawPhone}`;

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
          name: formData.name,
          phone: fullPhone, 
          email: formData.email,
          notes: formData.notes
      });

      setBookingLoading(false);

      if (result.error) {
          addToast({ type: 'error', title: 'Falha ao Agendar', message: result.error });
      } else {
          setStep(3); 
      }
  };

  const renderCalendar = () => {
      const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });
      const days = [];
      let day = startDate;

      const theme = rule?.theme_config || {};
      const primaryColor = theme.primaryColor || '#22c55e';
      const textColor = theme.textColor || '#ffffff';

      for (let i = 0; i < 35; i++) {
          const cloneDay = day;
          const isMonthMatch = isSameMonth(cloneDay, currentMonth);
          const isSelected = selectedDate ? isSameDay(cloneDay, selectedDate) : false;
          const isToday = isSameDay(cloneDay, new Date());
          
          const isAvailableDay = rule?.days_of_week?.includes(cloneDay.getDay());
          
          const todayStart = new Date();
          todayStart.setHours(0,0,0,0);
          const isPast = cloneDay < todayStart;
          
          const isDisabled = !isAvailableDay || isPast;

          days.push(
              <button
                  key={i}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setSelectedDate(cloneDay)}
                  className={cn(
                      "h-10 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all relative",
                      isDisabled && "opacity-20 cursor-not-allowed",
                      !isDisabled && !isSelected && "hover:bg-white/10"
                  )}
                  style={{
                      color: isSelected ? '#000' : (isMonthMatch ? textColor : `${textColor}60`),
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      border: isToday && !isSelected ? `1px solid ${primaryColor}60` : 'none'
                  }}
              >
                  {format(cloneDay, 'd')}
              </button>
          );
          day = addDays(day, 1);
      }
      return days;
  };

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
      );
  }

  if (!rule) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-6 p-6 text-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-2xl">
                  <CalendarIcon className="w-10 h-10 opacity-50" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Link Inválido</h1>
                <p className="text-sm max-w-xs mx-auto">Verifique o endereço digitado.</p>
              </div>
          </div>
      );
  }

  // --- ENGINE DE TEMA (Pixel Perfect Match) ---
  const theme = rule.theme_config || {};
  
  const pageBackground = theme.pageBackground || '#09090b';
  const cardColor = theme.cardColor || 'rgba(24, 24, 27, 0.9)';
  const textColor = theme.textColor || '#ffffff';
  const primaryColor = theme.primaryColor || '#22c55e';
  
  // Defaults para garantir que sempre haja um valor
  const coverOverlay = theme.coverOverlayOpacity !== undefined ? theme.coverOverlayOpacity : 0.6;
  const coverOffsetY = theme.coverOffsetY !== undefined ? theme.coverOffsetY : 50;

  const progress = ((step) / 3) * 100;

  return (
    <div className="min-h-screen flex flex-col md:items-center md:justify-center p-0 md:p-6 font-sans overflow-y-auto" style={{ background: pageBackground, color: textColor }}>
      
      {/* Barra de Progresso Mobile */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 md:hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <motion.div 
            className="h-full" 
            style={{ backgroundColor: primaryColor }}
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            transition={{ duration: 0.5 }}
          />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:min-h-[600px] h-[100dvh] md:h-auto relative md:rounded-3xl border border-white/10"
        style={{ backgroundColor: cardColor, backdropFilter: 'blur(12px)' }}
      >
        
        {/* --- LEFT SIDEBAR (INFO & CAPA) --- */}
        {/* LÓGICA CAPA FACEBOOK (1/3 TOP) */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-black/20 shrink-0">
            
            {/* Bloco Superior: Capa */}
            {rule.cover_url && (
                <div className="relative h-48 md:h-[33%] min-h-[160px] overflow-hidden shrink-0 w-full">
                    <img 
                        src={rule.cover_url} 
                        className="w-full h-full object-cover" 
                        alt="Capa" 
                        style={{ objectPosition: `center ${coverOffsetY}%` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" style={{ opacity: coverOverlay }}></div>
                </div>
            )}

            {/* Bloco Inferior: Conteúdo (Com overlap do avatar) */}
            <div className={cn("flex-1 p-6 md:p-8 flex flex-col relative z-10", rule.cover_url ? "-mt-12" : "")}>
                
                {/* Header Perfil */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative shrink-0">
                        {rule.owner_avatar ? (
                            <img src={rule.owner_avatar} className="w-20 h-20 rounded-full border-4 border-black/50 object-cover shadow-lg bg-zinc-800" alt="Avatar" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-black/50 font-bold text-xl text-white">
                                {(rule.company_name || rule.name || 'C').charAt(0)}
                            </div>
                        )}
                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-black" style={{ backgroundColor: primaryColor }}></div>
                    </div>
                    <div className={cn(rule.cover_url ? "pt-8" : "")}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5" style={{ color: textColor }}>{rule.company_name || 'Profissional'}</p>
                        <h3 className="text-lg font-bold leading-tight" style={{ color: textColor }}>{rule.owner_name || 'Consultor'}</h3>
                    </div>
                </div>

                {/* Título com Gradiente Opcional */}
                <h1 
                    className="text-2xl font-bold mb-2 leading-tight inline-block w-fit"
                    style={{ 
                        background: theme.titleGradient ? `linear-gradient(to right, ${theme.titleGradient[0]}, ${theme.titleGradient[1]})` : textColor,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent' // Fallback
                    }}
                >
                    {rule.name}
                </h1>
                
                <p className="text-sm mb-6 opacity-80" style={{ color: textColor }}>{rule.event_goal || 'Reunião de Alinhamento'}</p>
                
                {/* Detalhes do Evento */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm p-3 rounded-xl border border-white/5 bg-white/5" style={{ color: textColor }}>
                        <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                        <span className="font-medium">{rule.slot_duration} min</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm p-3 rounded-xl border border-white/5 bg-white/5" style={{ color: textColor }}>
                        <MapPin className="w-5 h-5 text-blue-400" />
                        <div className="flex flex-col">
                             <span className="font-medium capitalize">{rule.event_location_type || 'Online'}</span>
                             <span className="text-[10px] opacity-60">{rule.event_location_details || 'Link enviado após agendar'}</span>
                        </div>
                    </div>
                </div>
                
                {/* Resumo Dinâmico da Seleção */}
                <AnimatePresence>
                {selectedDate && selectedTime && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="pt-6 border-t border-white/10 mt-6"
                    >
                        <p className="text-[10px] uppercase font-bold mb-1 opacity-50" style={{ color: textColor }}>Selecionado</p>
                        <div>
                            <div className="text-sm font-bold capitalize mb-0.5" style={{ color: primaryColor }}>{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</div>
                            <div className="text-2xl font-mono font-bold" style={{ color: textColor }}>{selectedTime}</div>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>

        {/* --- RIGHT CONTENT (CALENDAR & FORM) --- */}
        <div className="flex-1 relative flex flex-col h-full overflow-hidden">
            
            {step > 0 && step < 3 && (
                <div className="md:hidden flex items-center p-4 border-b border-white/10 z-20 sticky top-0 backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={() => setStep(step - 1)} className="p-2 -ml-2 hover:opacity-80">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-sm ml-2">
                        {step === 1 ? 'Escolher Horário' : 'Seus Dados'}
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
            <AnimatePresence mode="wait">
                
                {/* STEP 0: CALENDAR GRID */}
                {step === 0 && (
                    <motion.div key="step0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 opacity-60" />
                                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                            </h2>
                            <div className="flex gap-2 rounded-lg p-1 border border-white/10 bg-white/5">
                                <button onClick={() => setCurrentMonth(subWeeks(currentMonth, 4))} className="p-2 hover:bg-white/10 rounded-md transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button onClick={() => setCurrentMonth(addWeeks(currentMonth, 4))} className="p-2 hover:bg-white/10 rounded-md transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center mb-2">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                <div key={d} className="text-xs font-bold uppercase opacity-50">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                            {renderCalendar()}
                        </div>
                        <div className="mt-8 text-center text-xs opacity-50">
                            Fuso Horário: Horário Padrão de Brasília
                        </div>
                    </motion.div>
                )}

                {/* STEP 1: TIME SLOTS */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-6 hidden md:flex">
                            <Button variant="ghost" size="icon" onClick={() => setStep(0)} className="hover:bg-white/10 -ml-3" style={{ color: textColor }}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                                Horários Disponíveis
                            </h2>
                        </div>
                        
                        {loadingSlots ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                                <Loader2 className="w-10 h-10 opacity-50 animate-spin" />
                                <span className="opacity-50 text-sm">Buscando disponibilidade...</span>
                            </div>
                        ) : slots.length === 0 ? (
                            <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                                <p className="opacity-50">Nenhum horário disponível para este dia.</p>
                                <Button variant="link" onClick={() => setStep(0)} className="mt-2" style={{ color: primaryColor }}>Escolher outra data</Button>
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
                                                ? "hover:shadow-lg hover:border-opacity-50"
                                                : "opacity-20 cursor-not-allowed line-through bg-black/20 border-transparent"
                                        )}
                                        style={slot.available ? {
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: textColor
                                        } : {}}
                                        onMouseEnter={(e) => {
                                            if(slot.available) {
                                                e.currentTarget.style.backgroundColor = primaryColor;
                                                e.currentTarget.style.color = '#000';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if(slot.available) {
                                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = textColor;
                                            }
                                        }}
                                    >
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 2: FORM */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 max-w-md mx-auto">
                        <div className="flex items-center gap-3 mb-2 hidden md:flex">
                            <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="hover:bg-white/10 -ml-3" style={{ color: textColor }}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                                Preencha seus dados
                            </h2>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase ml-1 opacity-60">Qual o seu nome?</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-5 h-5 opacity-50" />
                                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="pl-10 bg-black/20 border-white/10 h-12 text-base rounded-xl focus:ring-1 placeholder:text-white/30" style={{ '--tw-ring-color': primaryColor, color: textColor, borderColor: `${textColor}20` } as any} placeholder="Digite aqui..." autoFocus />
                                </div>
                            </div>
                            <div className="space-y-1.5 relative z-20">
                                <label className="text-xs font-bold uppercase ml-1 opacity-60">Seu WhatsApp (Para confirmação)</label>
                                <div className="flex gap-2">
                                    <div className="relative" ref={countryDropdownRef}>
                                        <button type="button" className="h-12 bg-black/20 border border-white/10 rounded-xl px-3 flex items-center gap-2 hover:border-white/30 transition-colors min-w-[90px]" onClick={() => setIsCountryOpen(!isCountryOpen)} style={{ borderColor: `${textColor}20` }}>
                                            <span className="text-xl">{selectedCountry.flag}</span>
                                            <span className="text-sm font-bold opacity-80" style={{ color: textColor }}>+{selectedCountry.code}</span>
                                            <ChevronDown className="w-3 h-3 opacity-50 ml-auto" style={{ color: textColor }} />
                                        </button>
                                        {isCountryOpen && (
                                            <div className="absolute top-14 left-0 w-56 bg-[#18181b] border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                {COUNTRIES.map(c => (
                                                    <button key={c.code} type="button" className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left" onClick={() => { setSelectedCountry(c); setIsCountryOpen(false); setPhoneNumber(''); phoneInputRef.current?.focus(); }}>
                                                        <span className="text-lg">{c.flag}</span>
                                                        <div className="flex flex-col"><span className="text-sm font-medium text-white">{c.label}</span><span className="text-xs text-zinc-500">+{c.code}</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative flex-1">
                                        <Phone className="absolute left-3 top-3.5 w-5 h-5 opacity-50" />
                                        <Input ref={phoneInputRef} value={phoneNumber} onChange={handlePhoneInput} className="pl-10 bg-black/20 border-white/10 h-12 text-base rounded-xl focus:ring-1 font-mono placeholder:text-white/30" style={{ '--tw-ring-color': primaryColor, color: textColor, borderColor: `${textColor}20` } as any} placeholder={selectedCountry.mask} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase ml-1 opacity-60">Email (Opcional)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 opacity-50" />
                                    <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-10 bg-black/20 border-white/10 h-12 text-base rounded-xl focus:ring-1 placeholder:text-white/30" style={{ '--tw-ring-color': primaryColor, color: textColor, borderColor: `${textColor}20` } as any} placeholder="seu@email.com" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase ml-1 opacity-60">Observações</label>
                                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="bg-black/20 border-white/10 min-h-[100px] rounded-xl focus:ring-1 p-3 placeholder:text-white/30" style={{ '--tw-ring-color': primaryColor, color: textColor, borderColor: `${textColor}20` } as any} placeholder="Gostaria de falar sobre..." />
                            </div>
                            <Button 
                                onClick={handleBooking} 
                                disabled={bookingLoading} 
                                className="w-full h-12 rounded-xl text-base shadow-lg mt-4 transition-all active:scale-95 font-bold text-black"
                                style={{ backgroundColor: primaryColor, boxShadow: `0 0 25px ${primaryColor}40` }}
                            >
                                {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Agendamento'}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center p-4">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-2xl animate-in zoom-in duration-500" style={{ backgroundColor: `${primaryColor}20` }}>
                            <CheckCircle2 className="w-12 h-12" style={{ color: primaryColor }} />
                        </div>
                        <h2 className="text-4xl font-bold mb-4 tracking-tight">Agendado!</h2>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 max-w-sm w-full mb-8">
                            <p className="text-sm mb-1 opacity-70">{rule.event_goal} confirmada para</p>
                            <p className="text-xl font-bold capitalize">{format(selectedDate!, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                            <div className="text-3xl font-mono font-bold mt-2" style={{ color: primaryColor }}>{selectedTime}</div>
                        </div>
                        <p className="text-sm max-w-xs mb-8 opacity-70">
                            Enviamos os detalhes para o seu WhatsApp.
                        </p>
                        <Button variant="outline" onClick={() => window.location.reload()} className="border-white/20 bg-transparent hover:bg-white/10 rounded-xl" style={{ color: textColor }}>
                            Fazer novo agendamento
                        </Button>
                    </motion.div>
                )}

            </AnimatePresence>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
