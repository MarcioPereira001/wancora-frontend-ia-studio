
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
  
  const contactsRef = useRef<ChatContact[]>([]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  const sortContacts = useCallback((list: ChatContact[]) => {
      return [...list].sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; 
      });
  }, []);

  const fetchSingleContact = async (jid: string) => {
      if (!user?.company_id) return null;
      
      // 🛡️ GUARDIÃO ANTI-LID: O frontend NUNCA deve renderizar LIDs.
      if (jid.includes('@lid')) return null;

      try {
          const { data, error } = await supabase.rpc('get_contact_details', {
              p_company_id: user.company_id,
              p_jid: jid
          });

          if (error) return null;

          const item = Array.isArray(data) ? data[0] : data;

          if (item) {
              if (!item.last_message_at && item.unread_count === 0) return null;

              return {
                  id: item.jid,
                  jid: item.jid,
                  remote_jid: item.jid,
                  company_id: user.company_id,
                  name: item.name || item.push_name || item.phone,
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
          console.error("Fetch Error:", e);
      }
      return null;
  };

  const refreshList = useCallback(async (showLoading = false) => {
      if (!user?.company_id) return;
      if (showLoading) setLoading(true);
      
      try {
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) throw rpcError;

          // Filtra LIDs que possam ter escapado da RPC por segurança
          const formatted: ChatContact[] = (data || [])
            .filter((row: any) => !row.jid.includes('@lid')) 
            .map((row: any) => ({
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

    // --- REALTIME CHANNELS ---
    
    // 1. Contatos
    const contactsChannel = supabase.channel(`chat-list-contacts:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const newData = payload.new;
              
              // 🛡️ GUARDIÃO ANTI-LID REALTIME: Ignora eventos de LIDs
              if (newData.jid.includes('@lid')) return;

              if (newData.is_ignored) {
                  setContacts(prev => prev.filter(c => c.jid !== newData.jid));
                  return;
              }

              const exists = contactsRef.current.some(c => c.jid === newData.jid);

              if (exists) {
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
                   return;
              }

              // Verifica se vale a pena buscar (tem msg ou unread?)
              if (Object.keys(newData).every(k => ['id', 'jid', 'company_id', 'is_online', 'last_seen_at', 'updated_at'].includes(k)) && !newData.last_message_at) {
                  return; // Ignora ghosts online sem mensagem
              }

              const fullContact = await fetchSingleContact(newData.jid);
              
              if (fullContact) {
                  setContacts(prev => {
                      if (prev.some(c => c.jid === fullContact.jid)) return prev;
                      return sortContacts([fullContact, ...prev]);
                  });
              }
          }
      })
      .subscribe();

    // 2. Mensagens
    const messagesChannel = supabase.channel(`chat-list-messages:${user.company_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `company_id=eq.${user.company_id}` 
      }, async (payload) => {
          const newMsg = payload.new;
          
          // 🛡️ GUARDIÃO ANTI-LID MENSAGENS
          if (newMsg.remote_jid.includes('@lid')) return;

          if (Date.now() - new Date(newMsg.created_at).getTime() > 60000 * 5) return;

          const targetJid = newMsg.remote_jid;
          
          setContacts(prev => {
              const existingIndex = prev.findIndex(c => c.jid === targetJid);
              
              if (existingIndex >= 0) {
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
                  fetchSingleContact(targetJid).then(fullContact => {
                      if(fullContact) {
                          setContacts(current => {
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
