import React from 'react';
import { Calendar, MessageCircle, Flame, User, Tag, Clock } from 'lucide-react';
import { Lead, TeamMember } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { DeadlineTimer } from './DeadlineTimer'; // Componente Novo

interface KanbanCardProps {
  lead: Lead;
  owner?: TeamMember; 
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onClick: (lead: Lead) => void;
}

export function KanbanCard({ lead, owner, onDragStart, onClick }: KanbanCardProps) {
  
  const getTempConfig = (temp?: string) => {
    switch(temp) {
      case 'hot': return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'animate-pulse' };
      case 'warm': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: '' };
      default: return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: '' };
    }
  };

  const temp = getTempConfig(lead.temperature);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={() => onClick(lead)}
      className="group bg-zinc-900/90 hover:bg-zinc-900 backdrop-blur-sm border border-zinc-800 p-3.5 rounded-xl mb-3 hover:border-primary/50 hover:shadow-[0_4px_20px_-10px_rgba(34,197,94,0.15)] transition-all duration-200 relative cursor-grab active:cursor-grabbing select-none"
    >
      {/* Indicador de Status Lateral */}
      <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-60", temp.bg.replace('/10', ''))} />

      {/* Header */}
      <div className="flex justify-between items-start mb-2 pl-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 relative">
            {lead.profile_pic_url ? (
              <img src={lead.profile_pic_url} alt={lead.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-xs font-bold text-zinc-400">{lead.name.charAt(0).toUpperCase()}</span>
            )}
            
            {/* Responsável Mini Avatar */}
            {owner && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden" title={`Responsável: ${owner.name}`}>
                    {owner.avatar_url ? (
                        <img src={owner.avatar_url} alt={owner.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[8px] font-bold text-zinc-400">{owner.name.charAt(0)}</span>
                    )}
                </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100 truncate leading-tight">{lead.name}</h4>
            <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">{lead.phone}</p>
          </div>
        </div>
      </div>

      {/* Cronômetro de Deadline (Se existir) */}
      {lead.deadline && (
          <div className="pl-2 mb-2">
              <DeadlineTimer deadline={lead.deadline} compact />
          </div>
      )}

      {/* Tags e Valor */}
      <div className="flex flex-wrap gap-2 mb-3 pl-2">
        <div className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 flex items-center gap-1.5 shadow-sm">
             <span className="text-xs font-bold text-green-400 font-mono tracking-tight">
                {formatCurrency(lead.value_potential || 0)}
             </span>
        </div>
        
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider", temp.bg, temp.color, temp.border)}>
          <Flame size={10} className={temp.icon} />
          {lead.temperature === 'hot' ? 'Quente' : lead.temperature === 'warm' ? 'Morno' : 'Frio'}
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 pl-2 mt-1">
        <div className="flex items-center gap-2">
          {/* Se tem tag, mostra a primeira */}
          {lead.tags && lead.tags.length > 0 ? (
             <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50">
                <Tag size={8} /> {lead.tags[0]} {lead.tags.length > 1 && `+${lead.tags.length - 1}`}
             </div>
          ) : (
             <span className="text-[10px] text-zinc-600 italic">Sem tags</span>
          )}
        </div>
        
        <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center z-10 hover:z-20 hover:scale-110 transition-transform cursor-pointer" title="Ver mensagens">
                <MessageCircle size={10} className="text-blue-400" />
            </div>
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center z-0 cursor-pointer" title="Ver perfil">
                <User size={10} className="text-zinc-400" />
            </div>
        </div>
      </div>
    </div>
  );
}