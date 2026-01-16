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

        // 2. Fetch Links
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

    // Realtime Listeners (Suporte a atualização de outros usuários)
    const subChecklist = supabase.channel(`lead_checklists:${leadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_checklists', filter: `lead_id=eq.${leadId}` }, (payload) => {
            if(payload.eventType === 'INSERT') {
                setChecklist(prev => {
                    // Evita duplicatas se já adicionamos otimisticamente
                    if(prev.some(i => i.id === payload.new.id)) return prev;
                    return [...prev, payload.new as ChecklistItem];
                });
            }
            if(payload.eventType === 'UPDATE') setChecklist(prev => prev.map(i => i.id === payload.new.id ? payload.new as ChecklistItem : i));
            if(payload.eventType === 'DELETE') setChecklist(prev => prev.filter(i => i.id !== payload.old.id));
        })
        .subscribe();

    const subLinks = supabase.channel(`lead_links:${leadId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_links', filter: `lead_id=eq.${leadId}` }, (payload) => {
            if(payload.eventType === 'INSERT') {
                setLinks(prev => {
                    if(prev.some(l => l.id === payload.new.id)) return prev;
                    return [payload.new as LeadLink, ...prev];
                });
            }
            if(payload.eventType === 'DELETE') setLinks(prev => prev.filter(i => i.id !== payload.old.id));
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(subChecklist); 
        supabase.removeChannel(subLinks);
    };
  }, [leadId, leadPhone, user?.company_id]);

  // --- ACTIONS (OPTIMISTIC UPDATES) ---

  const sendMessage = async (text: string) => {
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
      if(!leadId || !user?.company_id) return;
      
      // 1. Optimistic Update (Cria ID temporário)
      const tempId = `temp-${Date.now()}`;
      const tempItem: ChecklistItem = {
          id: tempId,
          lead_id: leadId,
          company_id: user.company_id, // Local update consistency
          text,
          is_completed: false,
          deadline: deadline,
          created_at: new Date().toISOString()
      };
      
      setChecklist(prev => [...prev, tempItem]);

      // 2. Server Call
      const { data, error } = await supabase
        .from('lead_checklists')
        .insert({ 
            lead_id: leadId, 
            company_id: user.company_id, // RLS Requirement
            text, 
            is_completed: false, 
            deadline: deadline || null 
        })
        .select()
        .single();
      
      // 3. Reconcile or Rollback
      if(error) {
          console.error("Erro insert task:", error);
          setChecklist(prev => prev.filter(i => i.id !== tempId));
          addToast({ type: 'error', title: 'Erro', message: 'Erro ao salvar tarefa.' });
      } else if (data) {
          setChecklist(prev => prev.map(i => i.id === tempId ? data : i));
      }
  };

  const toggleCheckitem = async (id: string, currentStatus: boolean) => {
      setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: !currentStatus } : i));
      const { error } = await supabase.from('lead_checklists').update({ is_completed: !currentStatus }).eq('id', id);
      if(error) {
          // Rollback
          setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: currentStatus } : i));
      }
  };

  const updateCheckitemDeadline = async (id: string, deadline: string | null) => {
      setChecklist(prev => prev.map(i => i.id === id ? { ...i, deadline } : i));
      const { error } = await supabase.from('lead_checklists').update({ deadline }).eq('id', id);
      if(error) addToast({ type: 'error', title: 'Erro', message: 'Falha ao atualizar prazo.' });
  };

  const deleteCheckitem = async (id: string) => {
      const original = checklist;
      setChecklist(prev => prev.filter(i => i.id !== id));
      const { error } = await supabase.from('lead_checklists').delete().eq('id', id);
      if(error) {
          setChecklist(original);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao excluir.' });
      }
  };

  // --- LINKS ACTIONS ---
  const addLink = async (title: string, url: string) => {
      if(!leadId || !user?.company_id) return;
      let finalUrl = url;
      if (!/^https?:\/\//i.test(url)) finalUrl = 'https://' + url;

      const tempId = `temp-${Date.now()}`;
      const tempLink: LeadLink = { 
          id: tempId, 
          lead_id: leadId, 
          company_id: user.company_id, // Local update
          title, 
          url: finalUrl, 
          created_at: new Date().toISOString() 
      };
      setLinks(prev => [tempLink, ...prev]);

      const { data, error } = await supabase.from('lead_links').insert({ 
          lead_id: leadId, 
          company_id: user.company_id, // RLS Requirement
          title, 
          url: finalUrl 
      }).select().single();

      if(error) {
          console.error("Erro insert link:", error);
          setLinks(prev => prev.filter(l => l.id !== tempId));
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar link.' });
      } else if(data) {
          setLinks(prev => prev.map(l => l.id === tempId ? data : l));
      }
  };

  const deleteLink = async (id: string) => {
      const original = links;
      setLinks(prev => prev.filter(l => l.id !== id));
      const { error } = await supabase.from('lead_links').delete().eq('id', id);
      if(error) setLinks(original);
  };

  return { 
      messages, checklist, links, loading, 
      sendMessage, addCheckitem, toggleCheckitem, updateCheckitemDeadline, deleteCheckitem,
      addLink, deleteLink
  };
}