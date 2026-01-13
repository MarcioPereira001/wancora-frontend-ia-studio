import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DeadlineTimerProps {
  deadline: string;
  isCompleted?: boolean;
  compact?: boolean;
}

export function DeadlineTimer({ deadline, isCompleted, compact = false }: DeadlineTimerProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Atualiza a cada minuto para poupar recursos, ou a cada segundo se estiver muito perto
    const interval = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(interval);
  }, []);

  if (isCompleted) {
      return (
          <div className={cn("flex items-center gap-1 text-zinc-500", compact ? "text-[10px]" : "text-xs")}>
              <CheckCircle2 size={compact ? 10 : 12} />
              <span>Concluído</span>
          </div>
      );
  }

  const dateDeadline = new Date(deadline);
  const diffMinutes = differenceInMinutes(dateDeadline, now);
  
  // Lógica de Status
  let status: 'safe' | 'warning' | 'overdue' = 'safe';
  if (diffMinutes < 0) status = 'overdue';
  else if (diffMinutes < 24 * 60) status = 'warning'; // Menos de 24h

  // Configuração Visual
  const config = {
      safe: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Clock },
      warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Clock },
      overdue: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle }
  }[status];

  const Icon = config.icon;
  const timeString = formatDistanceToNow(dateDeadline, { locale: ptBR, addSuffix: true });

  return (
    <div className={cn(
        "flex items-center gap-1.5 rounded-md border font-mono font-medium transition-colors",
        config.bg, config.color, config.border,
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
    )}>
        <Icon size={compact ? 10 : 12} className={status === 'overdue' ? 'animate-pulse' : ''} />
        <span className="whitespace-nowrap">
            {status === 'overdue' ? 'Vencido ' : ''}
            {timeString.replace('cerca de ', '')}
        </span>
    </div>
  );
}