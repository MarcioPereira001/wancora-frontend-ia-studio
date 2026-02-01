
import React from 'react';
import { Calendar, MessageCircle, Flame, User, Tag, Clock } from 'lucide-react';
import { Lead, TeamMember } from '@/types';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';
import { DeadlineTimer } from './DeadlineTimer'; 

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
  
  // LÓGICA DE EXIBIÇÃO ROBUSTA: Se nome for nulo, formata o telefone
  const displayName = lead.name || formatPhone(lead.phone) || "Sem Nome";
  const displayInitial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={() => onClick(lead)}
      className="group bg-zinc-900/90 hover:bg-zinc-900/95 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl mb-3 hover:border-primary/40 hover:shadow-[0_0_15px_-5px_rgba(34,197,94,0.15)] transition-all duration-300 relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
    >
      {/* Efeito Glow Lateral */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] transition-all group-hover:w-[4px]", temp.bg.replace('/10', ''))} />

      {/* Header */}
      <div className="flex justify-between items-start mb-2 pl-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-zinc-950 flex items-center justify-center shrink-0 border border-zinc-800 shadow-sm relative">
            {lead.profile_pic_url ? (
              <img src={lead.profile_pic_url} alt={displayName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-xs font-bold text-zinc-500">{displayInitial}</span>
            )}
            
            {owner && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden z-10" title={`Responsável: ${owner.name}`}>
                    {owner.avatar_url ? (
                        <img src={owner.avatar_url} alt={owner.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[8px] font-bold text-zinc-400">{(owner.name || '?').charAt(0)}</span>
                    )}
                </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100 truncate leading-tight group-hover:text-primary transition-colors">{displayName}</h4>
            <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">{lead.phone}</p>
          </div>
        </div>
      </div>

      {/* Cronômetro */}
      {lead.deadline && (
          <div className="pl-2 mb-2">
              <DeadlineTimer deadline={lead.deadline} compact />
          </div>
      )}

      {/* Tags e Valor */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pl-2">
        <div className="px-2 py-1 rounded bg-zinc-950/80 border border-zinc-800 flex items-center gap-1.5 shadow-sm">
             <span className="text-xs font-bold text-emerald-400 font-mono tracking-tight">
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
        <div className="flex items-center gap-2 max-w-[70%]">
          {lead.tags && lead.tags.length > 0 ? (
             <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50 truncate">
                <Tag size={8} /> 
                <span className="truncate">{lead.tags[0]} {lead.tags.length > 1 && `+${lead.tags.length - 1}`}</span>
             </div>
          ) : (
             <span className="text-[10px] text-zinc-700 italic">Sem tags</span>
          )}
        </div>
        
        <div className="flex -space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center z-10 hover:bg-zinc-800 hover:border-blue-500 transition-colors" title="Ver chat">
                <MessageCircle size={10} className="text-blue-400" />
            </div>
        </div>
      </div>
    </div>
  );
}
