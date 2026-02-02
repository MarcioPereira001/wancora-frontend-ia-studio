
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

  // Função de Ordenação Estrita (Mais recente -> Mais antigo)
  const sortContacts = useCallback((list: ChatContact[]) => {
      return [...list].sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; 
      });
  }, []);

  // Fetch Cirúrgico: Busca APENAS 1 contato completo usando a RPC
  // Isso evita o erro 400 de relacionamento e traz dados do Lead
  const fetchSingleContact = async (jid: string) => {
      if (!user?.company_id) return null;

      try {
          // Usa a RPC segura em vez de query direta complexa
          const { data, error } = await supabase.rpc('get_contact_details', {
              p_company_id: user.company_id,
              p_jid: jid
          });

          if (error) {
              console.error("Erro fetchSingleContact:", error);
              return null;
          }

          // RPC retorna array, pegamos o primeiro item
          const item = Array.isArray(data) ? data[0] : data;

          if (item) {
              return {
                  id: item.jid,
                  jid: item.jid,
                  remote_jid: item.jid,
                  company_id: user.company_id,
                  name: item.name || item.push_name || item.phone, // Prioridade de Nomes
                  push_name: item.push_name,
                  phone_number: item.phone,
                  profile_pic_url: item.profile_pic_url,
                  unread_count: item.unread_count,
                  last_message_at: item.last_message_at,
                  is_group: item.is_group,
                  is_community: item.is_community,
                  is_online: item.is_online,
                  lead_tags: item.lead_tags || [],
                  stage_name: item.stage_name,
                  stage_color: item.stage_color
              } as ChatContact;
          }
      } catch (e) {
          console.error("Exceção fetchSingleContact:", e);
      }
      return null;
  };

  const refreshList = useCallback(async (showLoading = false) => {
      if (!user?.company_id) return;
      if (showLoading) setLoading(true);
      
      try {
          // RPC Otimizada que já faz os Joins no banco
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

    // --- REALTIME: Estratégia "Merge Inteligente" ---
    
    // 1. Monitora Contatos (Nomes, Fotos, Status Online)
    const contactsChannel = supabase.channel(`chat-list-contacts:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', // INSERT ou UPDATE
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const newData = payload.new;
              
              if (newData.is_ignored) {
                  setContacts(prev => prev.filter(c => c.jid !== newData.jid));
                  return;
              }

              // DEDUPLICAÇÃO & PREVENÇÃO DE GHOSTS
              // Se é um update (ex: ficou online), mas não está na lista visual, 
              // só adicionamos se tiver mensagem (o fetchSingleContact vai validar isso,
              // mas podemos ser mais rápidos checando se já existe).
              const exists = contactsRef.current.some(c => c.jid === newData.jid);

              if (exists) {
                   // Se já existe, atualiza localmente para não pular a tela (anti-flicker)
                   setContacts(prev => prev.map(c => {
                       if (c.jid === newData.jid) {
                           return {
                               ...c,
                               is_online: newData.is_online,
                               last_seen_at: newData.last_seen_at,
                               profile_pic_url: newData.profile_pic_url || c.profile_pic_url,
                               name: newData.name || c.name,
                               unread_count: newData.unread_count
                           };
                       }
                       return c;
                   }));
                   // Não faz fetch completo se for apenas status online para performance
                   if (Object.keys(newData).length <= 4 && newData.last_seen_at) return;
              }

              // Se não existe ou é dados críticos, busca completo
              const fullContact = await fetchSingleContact(newData.jid);
              
              if (fullContact) {
                  setContacts(prev => {
                      const existsInner = prev.some(c => c.jid === fullContact.jid);
                      if (existsInner) {
                          return prev.map(c => c.jid === fullContact.jid ? { ...c, ...fullContact } : c);
                      }
                      // Se for novo, põe no topo
                      return sortContacts([fullContact, ...prev]);
                  });
              }
          }
      })
      .subscribe();

    // 2. Monitora Mensagens (Apenas para Reordenar / Subir conversa)
    const messagesChannel = supabase.channel(`chat-list-messages:${user.company_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          const newMsg = payload.new;
          // Ignora mensagens muito antigas (histórico) para evitar bagunça visual durante o sync
          const msgTime = new Date(newMsg.created_at).getTime();
          if (Date.now() - msgTime > 60000 * 5) return; // 5 minutos de tolerância

          const targetJid = newMsg.remote_jid;
          
          setContacts(prev => {
              const existingIndex = prev.findIndex(c => c.jid === targetJid);
              
              if (existingIndex >= 0) {
                  // Contato existe: Atualiza prévia e move pro topo
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
                  // Contato não está na lista visual. Busca e insere.
                  fetchSingleContact(targetJid).then(fullContact => {
                      if(fullContact) {
                          setContacts(current => {
                              // Dupla verificação de existência antes de inserir
                              if (current.some(c => c.jid === fullContact.jid)) return current;
                              return sortContacts([fullContact, ...current]);
                          });
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
