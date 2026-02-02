
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // REF: Mantém o estado atual acessível dentro dos listeners do Realtime sem recriá-los
  const contactsRef = useRef<ChatContact[]>([]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  // Função de Ordenação (Mensagem mais recente no topo)
  const sortContacts = useCallback((list: ChatContact[]) => {
      return [...list].sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; 
      });
  }, []);

  // Fetch Cirúrgico: Busca APENAS 1 contato completo (com Joins de Lead e Tags)
  // Isso resolve o problema de "nome sumindo" pois pegamos a versão mais recente do banco
  const fetchSingleContact = async (jid: string) => {
      if (!user?.company_id) return null;

      const { data } = await supabase
          .from('contacts')
          .select('*, leads(tags, status, pipeline_stage_id, pipeline_stages(name, color))')
          .eq('jid', jid)
          .eq('company_id', user.company_id)
          .single();

      if (data) {
          return {
              id: data.jid,
              jid: data.jid,
              remote_jid: data.jid,
              company_id: data.company_id,
              // Lógica de Prioridade de Nome: Agenda > PushName > Telefone
              name: data.name || data.push_name, 
              push_name: data.push_name,
              phone_number: data.phone,
              profile_pic_url: data.profile_pic_url,
              unread_count: data.unread_count,
              last_message_at: data.last_message_at,
              is_group: data.jid.includes('@g.us'),
              is_community: data.is_community,
              is_online: data.is_online,
              lead_tags: data.leads?.[0]?.tags || [],
              stage_name: data.leads?.[0]?.pipeline_stages?.name,
              stage_color: data.leads?.[0]?.pipeline_stages?.color
          } as ChatContact;
      }
      return null;
  };

  const refreshList = useCallback(async (showLoading = false) => {
      if (!user?.company_id) return;
      if (showLoading) setLoading(true);
      
      try {
          // RPC Otimizada do Banco de Dados
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) throw rpcError;

          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              id: row.jid, 
              remote_jid: row.jid, 
              last_message_time: row.last_message_at,
              phone_number: row.phone_number || (row.jid ? row.jid.split('@')[0] : ''),
              name: row.name || null,
              is_community: row.is_community || false,
              lead_tags: row.lead_tags || []
          }));

          setContacts(formatted); 
          setError(null);
      } catch (e: any) {
          console.error("ChatList Error:", e.message);
          setError(e.message);
      } finally {
          if (showLoading) setLoading(false);
      }
  }, [user?.company_id]);

  useEffect(() => {
    if (!user?.company_id) return;

    refreshList(true);

    // --- REALTIME: Estratégia de "Merge Inteligente" ---
    
    // 1. Monitora Contatos (Nomes, Fotos, Status)
    const contactsChannel = supabase.channel(`chat-list-contacts:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', // INSERT ou UPDATE
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const newData = payload.new;
              
              // Se foi ignorado/arquivado, remove da lista
              if (newData.is_ignored) {
                  setContacts(prev => prev.filter(c => c.jid !== newData.jid));
                  return;
              }

              // Busca dados completos (incluindo leads/tags)
              const fullContact = await fetchSingleContact(newData.jid);
              
              if (fullContact) {
                  setContacts(prev => {
                      const exists = prev.some(c => c.jid === fullContact.jid);
                      // Se já existe, atualiza mantendo a posição (para não pular)
                      if (exists) {
                          return prev.map(c => c.jid === fullContact.jid ? { ...c, ...fullContact } : c);
                      }
                      // Se é novo, põe no topo
                      return sortContacts([fullContact, ...prev]);
                  });
              }
          }
      })
      .subscribe();

    // 2. Monitora Mensagens (Para subir a conversa pro topo)
    const messagesChannel = supabase.channel(`chat-list-messages:${user.company_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          const newMsg = payload.new;
          const targetJid = newMsg.remote_jid;
          
          setContacts(prev => {
              const existingIndex = prev.findIndex(c => c.jid === targetJid);
              
              if (existingIndex >= 0) {
                  // Contato já existe: Atualiza prévia e move pro topo
                  const contact = { ...prev[existingIndex] };
                  contact.last_message_content = newMsg.content;
                  contact.last_message_type = newMsg.message_type;
                  contact.last_message_at = newMsg.created_at;
                  contact.last_message_time = newMsg.created_at;
                  
                  if (!newMsg.from_me) {
                      contact.unread_count = (contact.unread_count || 0) + 1;
                  }

                  const others = prev.filter(c => c.jid !== targetJid);
                  return [contact, ...others];
              } else {
                  // Contato novo na lista (Ghost Contact): Busca e insere
                  // Isso deve ser feito fora do setContacts para ser async, mas como fallback:
                  fetchSingleContact(targetJid).then(fullContact => {
                      if(fullContact) {
                          setContacts(current => sortContacts([fullContact, ...current]));
                      }
                  });
                  return prev;
              }
          });
      })
      .subscribe();

    return () => { 
        supabase.removeChannel(contactsChannel);
        supabase.removeChannel(messagesChannel);
    };
  }, [user?.company_id, refreshList, sortContacts]);

  return { contacts, loading, error, refreshList };
}
