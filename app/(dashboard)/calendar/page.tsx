
'use client';

import React, { useEffect, useState } from 'react';
import { useCalendarStore } from '@/store/useCalendarStore';
import { useAuthStore } from '@/store/useAuthStore';
import { DailySummary } from '@/components/calendar/DailySummary';
import { BigCalendar } from '@/components/calendar/BigCalendar';
import { NewAppointmentModal } from '@/components/calendar/NewAppointmentModal';
import { Button } from '@/components/ui/button';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, Settings, LayoutGrid, CalendarRange } from 'lucide-react';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';

export default function CalendarPage() {
  const { user } = useAuthStore();
  const { initializeCalendar, selectedDate, setSelectedDate, viewMode, setViewMode } = useCalendarStore();
  const router = useRouter();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<Appointment | null>(null);

  useEffect(() => {
      if(user?.company_id) {
          initializeCalendar(user.company_id);
      }
  }, [user?.company_id]);

  const handlePrev = () => {
      if (viewMode === 'week') setSelectedDate(subWeeks(selectedDate, 1));
      else setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
      if (viewMode === 'week') setSelectedDate(addWeeks(selectedDate, 1));
      else setSelectedDate(addMonths(selectedDate, 1));
  };
  
  const handleDateClick = (date: Date) => {
      setEditingEvent(null);
      setModalDate(date);
      setIsModalOpen(true);
  };

  const handleEventClick = (event: Appointment) => {
      setEditingEvent(event);
      setIsModalOpen(true);
  };

  const openNewModal = () => {
      setEditingEvent(null);
      setModalDate(new Date());
      setIsModalOpen(true);
  }

  const toggleViewMode = () => {
      setViewMode(viewMode === 'month' ? 'week' : 'month');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500 relative">
        
        {/* Topbar Navigation */}
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <CalIcon className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold text-white capitalize">
                        {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                    </h1>
                </div>
                <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button onClick={handlePrev} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"><ChevronLeft size={18} /></button>
                    <button onClick={() => setSelectedDate(new Date())} className="px-3 text-xs font-bold text-zinc-300 hover:text-white">Hoje</button>
                    <button onClick={handleNext} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push('/calendar/settings')} className="border-zinc-800 hover:bg-zinc-900 text-zinc-400">
                    <Settings className="w-4 h-4 mr-2" /> Configurar Agenda Pública
                </Button>
                <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                    <Plus className="w-4 h-4 mr-2" /> Novo Evento
                </Button>
            </div>
        </div>

        {/* Layout Principal */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
            <DailySummary />
            <BigCalendar 
                onDateClick={handleDateClick} 
                onEventClick={handleEventClick}
            />
        </div>

        {/* Botão Flutuante de View Mode */}
        <div className="absolute bottom-6 left-6 z-50">
            <Button 
                onClick={toggleViewMode} 
                className="rounded-full w-14 h-14 bg-zinc-900 border border-zinc-700 shadow-xl hover:bg-zinc-800 hover:scale-105 transition-all text-primary"
                title={viewMode === 'month' ? "Ver Semanal" : "Ver Mensal"}
            >
                {viewMode === 'month' ? <LayoutGrid size={24} /> : <CalendarRange size={24} />}
            </Button>
        </div>

        <NewAppointmentModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            preSelectedDate={modalDate}
            appointmentToEdit={editingEvent}
        />
    </div>
  );
}
