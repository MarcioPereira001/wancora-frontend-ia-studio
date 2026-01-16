import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineTimerProps {
  deadline: string;
  isCompleted?: boolean;
  compact?: boolean;
}

export function DeadlineTimer({ deadline, isCompleted, compact = false }: DeadlineTimerProps) {
  const [now, setNow] = useState(new Date());
  
  // Verifica se a data é válida
  const isValidDate = !isNaN(new Date(deadline).getTime());

  useEffect(() => {
    if (!isValidDate || isCompleted) return;

    // Se faltar menos de 24h, atualiza a cada segundo. Se não, a cada minuto.
    const target = new Date(deadline);
    const diffSec = (target.getTime() - new Date().getTime()) / 1000;
    const intervalTime = diffSec < 86400 && diffSec > -86400 ? 1000 : 60000;

    const interval = setInterval(() => setNow(new Date()), intervalTime); 
    return () => clearInterval(interval);
  }, [deadline, isCompleted, isValidDate]);

  if (!isValidDate) return null;

  if (isCompleted) {
      return (
          <div className={cn("flex items-center gap-1 text-zinc-500", compact ? "text-[10px]" : "text-xs")}>
              <CheckCircle2 size={compact ? 10 : 12} />
              <span>Concluído</span>
          </div>
      );
  }

  const dateDeadline = new Date(deadline);
  const diffSecondsVal = (dateDeadline.getTime() - now.getTime()) / 1000;
  
  // Lógica de Status
  let status: 'safe' | 'warning' | 'urgent' | 'overdue' = 'safe';
  
  if (diffSecondsVal < 0) status = 'overdue';
  else if (diffSecondsVal < 3600) status = 'urgent'; // Menos de 1h
  else if (diffSecondsVal < 86400) status = 'warning'; // Menos de 24h

  // Formatação do Tempo
  let timeString = '';
  
  if (Math.abs(diffSecondsVal) < 86400) {
      // Formato HH:MM:SS para menos de 24h (positivo ou negativo)
      const absSeconds = Math.abs(diffSecondsVal);
      const h = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(absSeconds % 60).toString().padStart(2, '0');
      timeString = `${h}:${m}:${s}`;
  } else {
      // Formato textual para prazos longos (dias)
      const days = Math.floor(Math.abs(diffSecondsVal) / 86400);
      timeString = `${days} dia${days !== 1 ? 's' : ''}`;
  }

  // Configuração Visual
  const config = {
      safe: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Clock },
      warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Hourglass },
      urgent: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: Hourglass },
      overdue: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle }
  }[status];

  const Icon = config.icon;

  return (
    <div className={cn(
        "flex items-center gap-1.5 rounded-md border font-mono font-medium transition-colors",
        config.bg, config.color, config.border,
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
    )}>
        <Icon size={compact ? 10 : 12} className={status === 'urgent' || status === 'overdue' ? 'animate-pulse' : ''} />
        <span className="whitespace-nowrap">
            {status === 'overdue' ? '-' : ''}{timeString}
        </span>
    </div>
  );
}