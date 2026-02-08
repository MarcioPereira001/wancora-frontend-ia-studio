
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2, MessageSquare, Bug, Lightbulb, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [type, setType] = useState<'bug' | 'suggestion' | 'other'>('suggestion');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
      if (!content.trim()) {
          addToast({ type: 'warning', title: 'Vazio', message: 'Por favor, escreva algo.' });
          return;
      }
      if (!user?.id) return;

      setIsSending(true);
      try {
          const { error } = await supabase.from('feedbacks').insert({
              user_id: user.id,
              company_id: user.company_id,
              type,
              content
          });

          if (error) throw error;

          addToast({ type: 'success', title: 'Recebido!', message: 'Obrigado pelo seu feedback.' });
          setContent('');
          onClose();
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar feedback.' });
      } finally {
          setIsSending(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enviar Feedback" maxWidth="sm">
        <div className="space-y-6">
            <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                <button 
                    onClick={() => setType('suggestion')}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-all", type === 'suggestion' ? "bg-blue-600 text-white shadow" : "text-zinc-500 hover:text-white")}
                >
                    <Lightbulb size={14} /> Sugestão
                </button>
                <button 
                    onClick={() => setType('bug')}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-all", type === 'bug' ? "bg-red-600 text-white shadow" : "text-zinc-500 hover:text-white")}
                >
                    <Bug size={14} /> Bug
                </button>
                <button 
                    onClick={() => setType('other')}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition-all", type === 'other' ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-white")}
                >
                    <MessageSquare size={14} /> Outro
                </button>
            </div>

            <div>
                <Textarea 
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={type === 'bug' ? "O que aconteceu? Como podemos reproduzir?" : "Qual sua ideia para melhorar o Wancora?"}
                    className="min-h-[120px] bg-zinc-950 border-zinc-800 resize-none"
                />
                <p className="text-[10px] text-zinc-500 mt-2 text-right">
                    Seu feedback vai direto para nossa equipe de produto.
                </p>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={isSending} className="w-full bg-white text-black hover:bg-zinc-200">
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Enviar
                </Button>
            </div>
        </div>
    </Modal>
  );
}
