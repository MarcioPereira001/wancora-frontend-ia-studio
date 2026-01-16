import React, { useState } from 'react';
import { useLeadActivities } from '@/hooks/useLeadActivities';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, ClipboardList, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  leadId: string;
}

export function ActivityTimeline({ leadId }: ActivityTimelineProps) {
  const { activities, loading, addNote } = useLeadActivities(leadId);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
      if(!note.trim()) return;
      setIsSubmitting(true);
      await addNote(note);
      setNote('');
      setIsSubmitting(false);
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
    <div className="flex flex-col h-full space-y-4">
        {/* Input Area */}
        <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
            <Textarea 
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Escreva uma anotação sobre este lead..."
                className="bg-transparent border-none focus-visible:ring-0 min-h-[60px] text-sm resize-none px-0"
            />
            <div className="flex justify-between items-center mt-2 border-t border-zinc-800 pt-2">
                <span className="text-[10px] text-zinc-500">
                    Visível apenas para a equipe
                </span>
                <Button 
                    size="sm" 
                    onClick={handleSubmit} 
                    disabled={!note.trim() || isSubmitting}
                    className="h-7 text-xs"
                >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                    Salvar Nota
                </Button>
            </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
            {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-zinc-600 animate-spin" /></div>
            ) : activities.length === 0 ? (
                <p className="text-center text-zinc-500 text-xs py-4">Nenhuma atividade registrada.</p>
            ) : (
                activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 group">
                        {/* Icon Column */}
                        <div className="flex flex-col items-center">
                            <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center border shrink-0 z-10",
                                activity.type === 'note' ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                            )}>
                                {activity.type === 'note' ? <MessageSquare size={12} /> : <ClipboardList size={12} />}
                            </div>
                            <div className="w-px h-full bg-zinc-800 -mt-1 group-last:hidden" />
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-zinc-300">
                                        {activity.creator_name}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                        {formatDate(activity.created_at)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className={cn(
                                "text-sm leading-relaxed p-2.5 rounded-lg border",
                                activity.type === 'note' 
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-200" 
                                    : "bg-transparent border-transparent text-zinc-400 italic px-0 py-0"
                            )}>
                                {activity.content}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
}