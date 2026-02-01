
'use client';

import React, { useState } from 'react';
import { useCalendarStore } from '@/store/useCalendarStore';
import { createClient } from '@/utils/supabase/client';
import { ChevronUp, ChevronDown, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function DailySummary() {
  const { appointments, toggleTaskCompletionOptimistic } = useCalendarStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const supabase = createClient();

  const todayApps = appointments.filter(app => {
      const date = parseISO(app.start_time);
      return isToday(date) && app.status !== 'cancelled';
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const tasks = todayApps.filter(a => a.is_task);
  const meetings = todayApps.filter(a => !a.is_task);
  
  const completedTasks = tasks.filter(t => t.completed_at).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleToggleCheck = async (id: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;
      // Optimistic
      toggleTaskCompletionOptimistic(id, newStatus);
      // Server
      await supabase.from('appointments').update({ 
          completed_at: newStatus ? new Date().toISOString() : null 
      }).eq('id', id);
  };

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md mb-6 rounded-xl overflow-hidden transition-all duration-300">
        {/* Header Recolhível */}
        <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-white capitalize">
                        {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h2>
                    <p className="text-xs text-zinc-400 flex items-center gap-2">
                        <span>{meetings.length} Reuniões</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                        <span>{tasks.length} Tarefas</span>
                    </p>
                </div>
                
                {/* Mini Progress Bar */}
                <div className="hidden md:flex flex-col gap-1 w-32">
                    <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                        <span>Progresso</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                </div>
            </div>

            <button className="text-zinc-500 hover:text-white transition-colors">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
        </div>

        {/* Content Body */}
        {isExpanded && (
            <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                
                {/* Coluna 1: Tarefas Rápidas */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Tarefas do Dia</h3>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">Nenhuma tarefa pendente hoje.</p>
                    ) : (
                        tasks.map(task => (
                            <div 
                                key={task.id} 
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border transition-all group",
                                    task.completed_at 
                                        ? "bg-zinc-900/30 border-zinc-800 opacity-60" 
                                        : "bg-zinc-900/80 border-zinc-700 hover:border-primary/30"
                                )}
                            >
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleToggleCheck(task.id, !!task.completed_at); }}
                                    className="text-zinc-500 hover:text-green-500 transition-colors"
                                >
                                    {task.completed_at ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <span className={cn("text-sm block truncate", task.completed_at ? "line-through text-zinc-500" : "text-zinc-200")}>
                                        {task.title}
                                    </span>
                                    {task.lead && (
                                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            {task.lead.name}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-zinc-500 font-mono">
                                    {format(parseISO(task.start_time), 'HH:mm')}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                {/* Coluna 2: Próximas Reuniões */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Compromissos</h3>
                    {meetings.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">Agenda livre hoje.</p>
                    ) : (
                        meetings.map(meet => (
                            <div key={meet.id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-900/50">
                                <div className="p-2 bg-blue-500/10 rounded text-blue-400">
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm text-zinc-200 block font-medium">{meet.title}</span>
                                    <span className="text-xs text-zinc-500">
                                        {format(parseISO(meet.start_time), 'HH:mm')} - {format(parseISO(meet.end_time), 'HH:mm')}
                                    </span>
                                </div>
                                {meet.status === 'confirmed' ? (
                                    <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20">Confirmado</span>
                                ) : (
                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20">Pendente</span>
                                )}
                            </div>
                        ))
                    )}
                </div>

            </div>
        )}
    </div>
  );
}
