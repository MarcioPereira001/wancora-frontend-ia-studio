import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Message, ChecklistItem } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

export function useLeadData(leadId?: string, leadPhone?: string) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId || !user?.company_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Checklist (Tabela Correta: lead_checklists)
        const { data: list } = await supabase
            .from('lead_checklists') 
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at');
        
        if (list) setChecklist(list);

        // 2. Fetch Messages (se tiver telefone)
        if (leadPhone) {
            const cleanPhone = leadPhone.replace(/\D/g, '');
            if(cleanPhone.length > 5) {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('company_id', user.company_id)
                    .ilike('remote_jid', `%${cleanPhone}%`) // Busca aproximada para pegar @s.whatsapp.net
                    .order('created_at', { ascending: true });
                
                if (msgs) setMessages(msgs);
            }
        }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
    };

    fetchData();

    // Realtime Checklist
    const subChecklist = supabase.channel(`lead_checklists:${leadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_checklists', filter: `lead_id=eq.${leadId}` }, (payload) => {
            if(payload.eventType === 'INSERT') setChecklist(prev => [...prev, payload.new as ChecklistItem]);
            if(payload.eventType === 'UPDATE') setChecklist(prev => prev.map(i => i.id === payload.new.id ? payload.new as ChecklistItem : i));
            if(payload.eventType === 'DELETE') setChecklist(prev => prev.filter(i => i.id !== payload.old.id));
        })
        .subscribe();

    return () => { supabase.removeChannel(subChecklist); };
  }, [leadId, leadPhone, user?.company_id]);

  // Actions
  const sendMessage = async (text: string) => {
      if(!leadPhone || !user?.company_id) return;
      
      const tempId = Date.now().toString();
      const tempMsg: any = {
          id: tempId,
          content: text,
          body: text,
          from_me: true,
          created_at: new Date().toISOString(),
          message_type: 'text',
          status: 'sending'
      };
      setMessages(prev => [...prev, tempMsg]);

      try {
          await api.post('/message/send', {
              sessionId: 'default', // TODO: Idealmente pegar a sessão ativa do usuário
              companyId: user.company_id,
              to: leadPhone.replace(/\D/g, ''), 
              text: text,
              type: 'text' 
          });
      } catch (error: any) {
          console.error("Erro envio:", error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar mensagem.' });
          setMessages(prev => prev.filter(m => m.id !== tempId));
      }
  };

  const addCheckitem = async (text: string) => {
      if(!leadId) return;
      // Optimistic
      const tempItem: ChecklistItem = { 
          id: 'temp-'+Date.now(), lead_id: leadId, text, is_completed: false, created_at: new Date().toISOString() 
      };
      setChecklist(prev => [...prev, tempItem]);

      // Insert Correto
      const { data, error } = await supabase
        .from('lead_checklists')
        .insert({ lead_id: leadId, text, is_completed: false })
        .select()
        .single();
      
      if(error) {
          setChecklist(prev => prev.filter(i => i.id !== tempItem.id));
          addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar tarefa.' });
      } else {
          setChecklist(prev => prev.map(i => i.id === tempItem.id ? data : i));
      }
  };

  const toggleCheckitem = async (id: string, currentStatus: boolean) => {
      // Optimistic
      setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: !currentStatus } : i));
      
      const { error } = await supabase.from('lead_checklists').update({ is_completed: !currentStatus }).eq('id', id);
      if(error) {
          setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: currentStatus } : i));
      }
  };

  return { messages, checklist, loading, sendMessage, addCheckitem, toggleCheckitem };
}