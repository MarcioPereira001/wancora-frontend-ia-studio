import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Message, ChecklistItem, LeadLink } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

export function useLeadData(leadId?: string, leadPhone?: string) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [links, setLinks] = useState<LeadLink[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId || !user?.company_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Checklist
        const { data: list } = await supabase
            .from('lead_checklists') 
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at');
        if (list) setChecklist(list);

        // 2. Fetch Links (NOVO)
        const { data: linkData } = await supabase
            .from('lead_links')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });
        if (linkData) setLinks(linkData);

        // 3. Fetch Messages
        if (leadPhone) {
            const cleanPhone = leadPhone.replace(/\D/g, '');
            if(cleanPhone.length > 5) {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('company_id', user.company_id)
                    .ilike('remote_jid', `%${cleanPhone}%`)
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

    // Realtime Listeners
    const subChecklist = supabase.channel(`lead_checklists:${leadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_checklists', filter: `lead_id=eq.${leadId}` }, (payload) => {
            if(payload.eventType === 'INSERT') setChecklist(prev => [...prev, payload.new as ChecklistItem]);
            if(payload.eventType === 'UPDATE') setChecklist(prev => prev.map(i => i.id === payload.new.id ? payload.new as ChecklistItem : i));
            if(payload.eventType === 'DELETE') setChecklist(prev => prev.filter(i => i.id !== payload.old.id));
        })
        .subscribe();

    const subLinks = supabase.channel(`lead_links:${leadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_links', filter: `lead_id=eq.${leadId}` }, (payload) => {
            if(payload.eventType === 'INSERT') setLinks(prev => [payload.new as LeadLink, ...prev]);
            if(payload.eventType === 'DELETE') setLinks(prev => prev.filter(i => i.id !== payload.old.id));
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(subChecklist); 
        supabase.removeChannel(subLinks);
    };
  }, [leadId, leadPhone, user?.company_id]);

  // --- ACTIONS ---

  const sendMessage = async (text: string) => {
      // (Mantido igual ao original...)
      if(!leadPhone || !user?.company_id) return;
      const tempId = Date.now().toString();
      const tempMsg: any = { id: tempId, content: text, body: text, from_me: true, created_at: new Date().toISOString(), message_type: 'text', status: 'sending' };
      setMessages(prev => [...prev, tempMsg]);
      try {
          await api.post('/message/send', { sessionId: 'default', companyId: user.company_id, to: leadPhone.replace(/\D/g, ''), text: text, type: 'text' });
      } catch (error: any) {
          console.error("Erro envio:", error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar mensagem.' });
          setMessages(prev => prev.filter(m => m.id !== tempId));
      }
  };

  const addCheckitem = async (text: string, deadline?: string) => {
      if(!leadId) return;
      const { data, error } = await supabase
        .from('lead_checklists')
        .insert({ lead_id: leadId, text, is_completed: false, deadline: deadline || null })
        .select()
        .single();
      
      if(error) addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar tarefa.' });
  };

  const toggleCheckitem = async (id: string, currentStatus: boolean) => {
      // Optimistic
      setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: !currentStatus } : i));
      const { error } = await supabase.from('lead_checklists').update({ is_completed: !currentStatus }).eq('id', id);
      if(error) setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: currentStatus } : i));
  };

  const updateCheckitemDeadline = async (id: string, deadline: string | null) => {
      const { error } = await supabase.from('lead_checklists').update({ deadline }).eq('id', id);
      if(error) addToast({ type: 'error', title: 'Erro', message: 'Falha ao atualizar prazo.' });
  };

  const deleteCheckitem = async (id: string) => {
      await supabase.from('lead_checklists').delete().eq('id', id);
  };

  // --- LINKS ACTIONS ---
  const addLink = async (title: string, url: string) => {
      if(!leadId) return;
      let finalUrl = url;
      if (!/^https?:\/\//i.test(url)) finalUrl = 'https://' + url;

      const { error } = await supabase.from('lead_links').insert({ lead_id: leadId, title, url: finalUrl });
      if(error) addToast({ type: 'error', title: 'Erro', message: 'Falha ao adicionar link.' });
  };

  const deleteLink = async (id: string) => {
      await supabase.from('lead_links').delete().eq('id', id);
  };

  return { 
      messages, checklist, links, loading, 
      sendMessage, addCheckitem, toggleCheckitem, updateCheckitemDeadline, deleteCheckitem,
      addLink, deleteLink
  };
}