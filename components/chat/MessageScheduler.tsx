'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { format } from 'date-fns';

interface MessageSchedulerProps {
  contactJid: string;
  sessionId: string;
  onSchedule: (content: string, date: Date) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageScheduler({ contactJid, sessionId, onSchedule, isOpen, onClose }: MessageSchedulerProps) {
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!message.trim() || !date || !time) {
      addToast({ type: 'warning', title: 'Campos vazios', message: 'Preencha mensagem, data e hora.' });
      return;
    }

    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) {
      addToast({ type: 'warning', title: 'Data inválida', message: 'O agendamento deve ser futuro.' });
      return;
    }

    onSchedule(message, scheduledDate);
    setMessage('');
    setDate('');
    setTime('');
    onClose();
  };

  return (
    <div className="absolute bottom-16 right-0 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-500" /> Agendar Mensagem
        </h4>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite a mensagem para agendar..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white resize-none h-20 focus:ring-1 focus:ring-purple-500 outline-none custom-scrollbar"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Data</label>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="h-8 text-xs bg-zinc-950 border-zinc-800"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Hora</label>
            <Input 
              type="time" 
              value={time} 
              onChange={e => setTime(e.target.value)}
              className="h-8 text-xs bg-zinc-950 border-zinc-800"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full bg-purple-600 hover:bg-purple-500 h-8 text-xs">
          <Calendar className="w-3 h-3 mr-2" /> Confirmar Agendamento
        </Button>
      </div>
    </div>
  );
}