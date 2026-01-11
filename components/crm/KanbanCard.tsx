import React from 'react';
import { Lead } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Phone, Mail } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface KanbanCardProps {
  lead: Lead;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onClick: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ lead, onDragStart, onClick }) => {
  return (
    <Card 
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      className="bg-zinc-900 border-zinc-800 cursor-grab hover:border-primary/50 transition-all hover:shadow-md active:cursor-grabbing mb-3"
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
            {lead.temperature && (
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                    lead.temperature === 'hot' ? 'border-red-900 bg-red-900/20 text-red-400' : 
                    lead.temperature === 'warm' ? 'border-orange-900 bg-orange-900/20 text-orange-400' :
                    'border-blue-900 bg-blue-900/20 text-blue-400'
                }`}>
                    {lead.temperature === 'hot' ? 'QUENTE' : lead.temperature === 'warm' ? 'MORNO' : 'FRIO'}
                </span>
            )}
        </div>
        
        <h4 className="font-medium text-white mb-1">{lead.name}</h4>
        
        {lead.value_potential ? (
            <div className="flex items-center text-green-400 text-xs font-mono mb-2">
                <DollarSign className="w-3 h-3 mr-1" />
                {formatCurrency(lead.value_potential)}
            </div>
        ) : null}

        <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{lead.notes || 'Sem observações.'}</p>

        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
             <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400">
                 {lead.name?.[0]}
             </div>
             <div className="ml-auto flex gap-1">
                 {lead.phone && <Phone className="w-3 h-3 text-zinc-500" />}
                 {lead.email && <Mail className="w-3 h-3 text-zinc-500" />}
             </div>
        </div>
      </CardContent>
    </Card>
  );
};