
'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { getMyAvailability, saveAvailabilityRules, type AvailabilityFormData } from '@/app/actions/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, Clock, Globe, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { addToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<AvailabilityFormData>({
    name: 'Minha Agenda',
    slug: '',
    days_of_week: [1, 2, 3, 4, 5],
    start_hour: '09:00',
    end_hour: '18:00',
    slot_duration: 30,
    is_active: true
  });

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
                is_active: data.is_active
            });
        } else if (user?.name) {
            // Suggest slug based on name
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
          const result = await saveAvailabilityRules(formData);
          
          if (result.error) {
              addToast({ type: 'error', title: 'Erro', message: result.error });
          } else {
              addToast({ type: 'success', title: 'Salvo', message: 'Regras de disponibilidade atualizadas.' });
          }
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha de comunicação.' });
      } finally {
          setIsSaving(false);
      }
  };

  if (isLoading) {
      return (
          <div className="flex items-center justify-center h-[calc(100vh-100px)]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
      );
  }

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/schedule/${formData.slug}` : `.../schedule/${formData.slug}`;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" />
          Configurar Disponibilidade
        </h1>
        <p className="text-zinc-400 mt-2">Defina seus horários de atendimento para o agendamento automático.</p>
      </div>

      <div className="grid gap-6">
        
        {/* Identidade */}
        <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg text-white">Identidade da Agenda</CardTitle>
                <CardDescription>Como sua agenda aparecerá para os clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome Interno</label>
                    <Input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="bg-zinc-950 border-zinc-800"
                    />
                </div>
                
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Link Público
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">wancora.app/schedule/</span>
                            <Input 
                                value={formData.slug} 
                                onChange={e => {
                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                    setFormData({...formData, slug: val});
                                }}
                                className="pl-[165px] bg-zinc-950 border-zinc-800 font-mono text-sm text-primary"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">
                        Use apenas letras minúsculas e hífens. Este link será enviado para seus leads.
                    </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 mt-2">
                    <span className="text-sm text-zinc-300 font-medium">Agenda Ativa</span>
                    <button 
                        onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                        className={cn(
                            "w-11 h-6 rounded-full transition-colors relative",
                            formData.is_active ? "bg-green-600" : "bg-zinc-700"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
                            formData.is_active ? "left-6" : "left-1"
                        )} />
                    </button>
                </div>
            </CardContent>
        </Card>

        {/* Horários */}
        <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg text-white">Horários de Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* Dias da Semana */}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block">Dias da Semana</label>
                    <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => {
                            const isSelected = formData.days_of_week.includes(day.id);
                            return (
                                <button
                                    key={day.id}
                                    onClick={() => toggleDay(day.id)}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border",
                                        isSelected 
                                            ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                                            : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                                    )}
                                    title={day.name}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Horas */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Início
                        </label>
                        <Input 
                            type="time" 
                            value={formData.start_hour}
                            onChange={e => setFormData({...formData, start_hour: e.target.value})}
                            className="bg-zinc-950 border-zinc-800" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Fim
                        </label>
                        <Input 
                            type="time" 
                            value={formData.end_hour}
                            onChange={e => setFormData({...formData, end_hour: e.target.value})}
                            className="bg-zinc-950 border-zinc-800" 
                        />
                    </div>
                </div>

                {/* Duração */}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Duração do Slot</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {DURATIONS.map(min => (
                            <button
                                key={min}
                                onClick={() => setFormData({...formData, slot_duration: min})}
                                className={cn(
                                    "px-2 py-2 rounded-md text-xs font-medium border transition-all",
                                    formData.slot_duration === min
                                        ? "bg-white text-black border-white"
                                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                                )}
                            >
                                {min} min
                            </button>
                        ))}
                    </div>
                </div>

            </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex justify-end pt-4">
            <Button 
                size="lg" 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-green-500/20 w-full sm:w-auto"
            >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                Salvar Configurações
            </Button>
        </div>

      </div>
    </div>
  );
}
