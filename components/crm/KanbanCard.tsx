import React from 'react';
import { Calendar, MessageCircle, Flame, MoreHorizontal, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';

interface KanbanCardProps {
  lead: Lead;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onClick: (lead: Lead) => void;
}

export function KanbanCard({ lead, onDragStart, onClick }: KanbanCardProps) {
  // Lógica visual da Temperatura
  const getTempColor = (temp?: string) => {
    switch(temp) {
      case 'hot': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warm': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={() => onClick(lead)}
      className="group bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 p-3 rounded-xl mb-3 hover:border-green-500/50 hover:shadow-[0_4px_20px_-10px_rgba(34,197,94,0.1)] transition-all duration-200 relative cursor-grab active:cursor-grabbing select-none"
    >
      {/* Indicador lateral de status */}
      <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-50", 
          lead.temperature === 'hot' ? 'bg-red-500' : lead.temperature === 'warm' ? 'bg-orange-500' : 'bg-blue-500'
      )} />

      {/* Header do Card */}
      <div className="flex justify-between items-start mb-2 pl-2">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
            {lead.profile_pic_url ? (
              <img src={lead.profile_pic_url} alt={lead.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-xs font-bold text-zinc-400">{lead.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100 truncate">{lead.name}</h4>
            <p className="text-[10px] text-zinc-500 font-mono truncate">{lead.phone}</p>
          </div>
        </div>
        <button className="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Badges e Valores */}
      <div className="flex flex-wrap gap-1.5 mb-3 pl-2">
        {lead.value_potential ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-green-400 font-mono">
                {formatCurrency(lead.value_potential)}
            </span>
        ) : null}

        <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border", getTempColor(lead.temperature))}>
          <Flame size={10} className={lead.temperature === 'hot' ? 'animate-pulse' : ''} />
          {lead.lead_score || 0} pts
        </div>
        
        {lead.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 truncate max-w-[80px]">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 pl-2">
        <div className="flex items-center gap-2">
          {lead.next_appointment_at ? (
             <div className="flex items-center gap-1 text-[10px] text-purple-400 bg-purple-400/10 px-2 py-1 rounded border border-purple-400/20">
                <Calendar size={10} />
                {format(new Date(lead.next_appointment_at), "dd/MM HH:mm", { locale: ptBR })}
             </div>
          ) : (
            <span className="text-[10px] text-zinc-600 italic">Sem agenda</span>
          )}
        </div>
        
        <div className="flex gap-1">
            <div className="p-1.5 rounded-full bg-zinc-800/50 text-zinc-500">
                <User size={12} />
            </div>
            <div className="p-1.5 rounded-full bg-green-500/10 text-green-500">
                <MessageCircle size={12} />
            </div>
        </div>
      </div>
    </div>
  );
}