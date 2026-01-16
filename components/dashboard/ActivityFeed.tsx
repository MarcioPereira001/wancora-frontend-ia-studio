import React from 'react';
import { ActivityItem } from '@/types';
import { CheckCircle2, MessageSquare, UserPlus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading: boolean;
}

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  
  if (loading) {
      return (
          <div className="flex flex-col gap-4 p-4">
              {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 w-full bg-zinc-800/30 rounded-lg animate-pulse" />
              ))}
          </div>
      );
  }

  if (activities.length === 0) {
      return (
          <div className="p-8 text-center text-zinc-500 text-sm italic">
              Nenhuma atividade registrada recentemente.
          </div>
      );
  }

  const getIcon = (type: string) => {
      switch(type) {
          case 'won_deal': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
          case 'new_lead': return <UserPlus className="w-4 h-4 text-blue-500" />;
          default: return <MessageSquare className="w-4 h-4 text-zinc-500" />;
      }
  };

  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date).replace('.', '');
    } catch (e) {
        return '';
    }
  };

  return (
    <div className="space-y-1 pr-2 custom-scrollbar max-h-[350px] overflow-y-auto">
        {activities.map((act) => (
            <div 
                key={act.id + act.type} 
                className="group flex gap-3 items-start p-3 rounded-lg hover:bg-zinc-800/30 transition-colors border border-transparent hover:border-zinc-800 cursor-default"
            >
                <div className={cn(
                    "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-opacity-20",
                    act.type === 'won_deal' ? "bg-green-500/10 border-green-500" :
                    act.type === 'new_lead' ? "bg-blue-500/10 border-blue-500" :
                    "bg-zinc-800 border-zinc-700"
                )}>
                    {getIcon(act.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-zinc-200 truncate">{act.title}</p>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1 shrink-0 bg-zinc-950 px-1.5 rounded">
                            <Clock className="w-3 h-3" />
                            {formatDate(act.created_at)}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1 group-hover:text-zinc-400 transition-colors">
                        {act.description}
                    </p>
                </div>
            </div>
        ))}
    </div>
  );
}