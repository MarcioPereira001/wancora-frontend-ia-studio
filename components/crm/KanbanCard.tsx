import React from 'react';
import { Lead } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Phone, Mail, User, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface KanbanCardProps {
  lead: Lead;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onClick: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ lead, onDragStart, onClick }) => {
  const getTemperatureStyle = (temp?: string) => {
    switch(temp) {
      case 'hot': return 'border-red-500/30 bg-red-500/10 text-red-400';
      case 'warm': return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
      case 'cold': return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      default: return 'border-zinc-700 bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      className="group relative mb-3 cursor-grab active:cursor-grabbing"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
      <Card className="relative bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all">
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
                <span className="font-semibold text-zinc-200 text-sm line-clamp-1">{lead.name}</span>
                {lead.value_potential ? (
                    <span className="text-xs font-mono text-green-400 flex items-center mt-0.5">
                        <DollarSign className="w-3 h-3 mr-0.5" />
                        {formatCurrency(lead.value_potential)}
                    </span>
                ) : null}
            </div>
            {lead.temperature && (
                <div className={`w-2 h-2 rounded-full ${lead.temperature === 'hot' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : lead.temperature === 'warm' ? 'bg-orange-500' : 'bg-blue-500'}`} />
            )}
          </div>

          {lead.notes && (
            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed bg-zinc-950/50 p-1.5 rounded border border-zinc-800/50">
              {lead.notes}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
             <div className="flex gap-2">
                 {lead.phone && <Phone className="w-3 h-3 text-zinc-600 hover:text-primary transition-colors" />}
                 {lead.email && <Mail className="w-3 h-3 text-zinc-600 hover:text-primary transition-colors" />}
             </div>
             <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'Hoje'}</span>
             </div>
          </div>
          
          <div className={`absolute top-0 right-0 w-full h-1 rounded-t-lg opacity-50 ${getTemperatureStyle(lead.temperature).split(' ')[0].replace('border', 'bg')}`} />
        </CardContent>
      </Card>
    </div>
  );
};