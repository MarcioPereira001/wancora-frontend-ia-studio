
'use client';

import React from 'react';
import { useCalendarStore } from '@/store/useCalendarStore';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Appointment } from '@/types';
import { Clock, CheckCircle2, Circle, User } from 'lucide-react';

interface BigCalendarProps {
  onDateClick: (date: Date) => void;
  onEventClick: (appointment: Appointment) => void;
}

export function BigCalendar({ onDateClick, onEventClick }: BigCalendarProps) {
  const { selectedDate, appointments, toggleTaskCompletionOptimistic, viewMode } = useCalendarStore();

  const isWeekly = viewMode === 'week';

  // Lógica de Grid baseada no View Mode
  const startDate = isWeekly ? startOfWeek(selectedDate) : startOfWeek(startOfMonth(selectedDate));
  const endDate = isWeekly ? endOfWeek(selectedDate) : endOfWeek(endOfMonth(selectedDate));

  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, "d");
      const cloneDay = day;
      
      const dayApps = appointments.filter(app => isSameDay(parseISO(app.start_time), cloneDay));
      
      const tasks = dayApps.filter(a => a.is_task).sort((a, b) => (a.completed_at ? 1 : 0) - (b.completed_at ? 1 : 0));
      const events = dayApps.filter(a => !a.is_task).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      days.push(
        <div
          key={day.toString()}
          onClick={() => onDateClick(cloneDay)}
          className={cn(
            "p-2 border border-zinc-800/50 relative group transition-colors hover:bg-zinc-900/30 cursor-pointer flex flex-col gap-1",
            isWeekly ? "min-h-[400px]" : "min-h-[120px]", // Altura maior para modo semanal
            !isSameMonth(day, selectedDate) && !isWeekly ? "bg-zinc-950/30 text-zinc-700" : "bg-zinc-900/10 text-zinc-400",
            isToday(day) ? "bg-primary/5" : ""
          )}
        >
          {/* Header do Dia */}
          <div className="flex justify-between items-center mb-1">
              <div className="flex flex-col items-center">
                  {isWeekly && <span className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{format(day, 'EEE', { locale: ptBR })}</span>}
                  <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isToday(day) ? "bg-primary text-white shadow-lg shadow-green-500/20" : ""
                  )}>
                      {formattedDate}
                  </span>
              </div>
              {!isWeekly && dayApps.length > 0 && <span className="text-[10px] text-zinc-600 font-mono">{dayApps.length}</span>}
          </div>

          {/* Lista de Eventos (Meetings) */}
          <div className="space-y-1">
              {events.map(event => (
                  <div 
                    key={event.id} 
                    onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                    }}
                    className={cn(
                        "text-[10px] px-1.5 py-1 rounded border truncate flex flex-col gap-0.5 hover:brightness-110 transition-all",
                        "bg-blue-500/10 border-blue-500/20 text-blue-300 cursor-pointer"
                    )}
                    title={event.title}
                  >
                      <div className="flex items-center gap-1 font-medium">
                          <Clock size={10} className="shrink-0" />
                          <span>{format(parseISO(event.start_time), 'HH:mm')} {event.title}</span>
                      </div>
                      {event.lead && (
                          <div className="flex items-center gap-1 text-[9px] text-blue-400/70 pl-3.5">
                              {/* CORREÇÃO AQUI: Fallback para nome nulo */}
                              <User size={8} /> {(event.lead.name || 'Lead').split(' ')[0]}
                          </div>
                      )}
                  </div>
              ))}
          </div>

          {/* Lista de Tarefas (Checklist) */}
          <div className="space-y-0.5 mt-auto">
              {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={cn(
                        "flex items-center gap-1.5 text-[10px] px-1 py-0.5 rounded transition-all group/task",
                        task.completed_at ? "text-zinc-600 line-through decoration-zinc-700" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                      <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskCompletionOptimistic(task.id, !task.completed_at);
                        }}
                        className="cursor-pointer"
                      >
                        {task.completed_at ? <CheckCircle2 size={10} className="text-green-600" /> : <Circle size={10} />}
                      </div>
                      <span 
                        className="truncate cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(task);
                        }}
                      >
                          {task.title}
                      </span>
                  </div>
              ))}
          </div>
          
          {/* Botão + (Hover) */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-primary hover:bg-opacity-80 shadow">
                  +
              </div>
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  // Header só no modo Mensal (No semanal já está dentro da célula)
  const daysHeader = !isWeekly ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
      <div key={d} className="text-center py-2 text-xs font-bold text-zinc-500 uppercase border-b border-zinc-800 bg-zinc-900/50">
          {d}
      </div>
  )) : null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {daysHeader && (
          <div className="grid grid-cols-7">
              {daysHeader}
          </div>
      )}
      <div>{rows}</div>
    </div>
  );
}
