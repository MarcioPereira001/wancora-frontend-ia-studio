
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
  
  // BUFFER DE ATUALIZAÇÃO (Anti-Jitter)
  const updatesBuffer = useRef<Map<string, any>>(new Map());
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Função de Ordenação Estrita (Mais recente -> Mais antigo)
  const sortContacts = useCallback((list: ChatContact[]) => {
      return [...list].sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; 
      });
  }, []);

  // Fetch Individual de Contato (Para Inserção Dinâmica)
  const fetchSingleContact = async (jid: string, companyId: string) => {
      // Tenta buscar o contato completo via RPC ou Tabela
      // Como o RPC get_my_chat_list não filtra por JID, vamos simular buscando da tabela contacts
      // e compondo com leads. É um fallback para garantir que o chat apareça.
      const { data: contact } = await supabase
          .from('contacts')
          .select('*, leads(tags)')
          .eq('jid', jid)
          .eq('company_id', companyId)
          .single();

      if (contact) {
          return {
              id: contact.jid,
              jid: contact.jid,
              remote_jid: contact.jid,
              company_id: contact.company_id,
              name: contact.name || contact.push_name,
              push_name: contact.push_name,
              phone_number: contact.phone,
              profile_pic_url: contact.profile_pic_url,
              unread_count: contact.unread_count,
              last_message_at: contact.last_message_at,
              is_group: contact.jid.includes('@g.us'),
              is_community: contact.is_community,
              lead_tags: contact.leads?.[0]?.tags || []
          } as ChatContact;
      }
      return null;
  };

  // Processador do Buffer (Debounced)
  const processBuffer = useCallback(async () => {
      if (updatesBuffer.current.size === 0) return;

      const updates = new Map<string, any>(updatesBuffer.current);
      updatesBuffer.current.clear(); // Limpa imediatamente para não processar dnv

      // Snapshot atual para modificação
      let newList = [...contacts];
      let needsSort = false;

      for (const [jid, payload] of updates) {
          const existingIndex = newList.findIndex(c => c.jid === jid);
          const existing = existingIndex >= 0 ? newList[existingIndex] : null;

          // 1. UPDATE DE CONTATO
          if (payload.type === 'contact_update') {
              const updatedRow = payload.data;
              
              // Se foi ignorado, remove da lista
              if (updatedRow.is_ignored) {
                  newList = newList.filter(c => c.jid !== jid);
                  continue;
              }

              if (existing) {
                  newList[existingIndex] = {
                      ...existing,
                      name: updatedRow.name || updatedRow.verified_name || updatedRow.push_name || existing.name,
                      push_name: updatedRow.push_name,
                      unread_count: updatedRow.unread_count,
                      last_message_at: updatedRow.last_message_at,
                      last_message_time: updatedRow.last_message_at, // Compatibilidade
                      profile_pic_url: updatedRow.profile_pic_url,
                      is_muted: updatedRow.is_muted,
                      is_online: updatedRow.is_online
                  };
                  needsSort = true;
              } else {
                  // Contato novo via update? Raro, mas possível. Tenta buscar full.
                  const fullContact = await fetchSingleContact(jid, updatedRow.company_id);
                  if (fullContact) {
                      newList.push(fullContact);
                      needsSort = true;
                  }
              }
          }
          
          // 2. NOVA MENSAGEM
          else if (payload.type === 'new_message') {
              const newMsg = payload.data;
              
              if (existing) {
                  // Atualiza existente
                  const updatedContact = { ...existing };
                  updatedContact.last_message_content = newMsg.content;
                  updatedContact.last_message_type = newMsg.message_type;
                  updatedContact.last_message_at = newMsg.created_at;
                  updatedContact.last_message_time = newMsg.created_at; // Compatibilidade
                  
                  if (!newMsg.from_me) {
                      updatedContact.unread_count = (updatedContact.unread_count || 0) + 1;
                  }

                  // Move para o topo logicamente
                  newList[existingIndex] = updatedContact;
                  needsSort = true;
              } else {
                  // --- CORREÇÃO CRÍTICA: NOVO CONTATO ---
                  // Se chegou mensagem de alguém que não está na lista, busca e insere!
                  // Isso evita o bug de "ter que dar F5" para ver conversas novas.
                  if (user?.company_id) {
                      const fullContact = await fetchSingleContact(jid, user.company_id);
                      if (fullContact) {
                          // Injeta dados da mensagem inicial
                          fullContact.last_message_content = newMsg.content;
                          fullContact.last_message_type = newMsg.message_type;
                          fullContact.last_message_at = newMsg.created_at;
                          if(!newMsg.from_me) fullContact.unread_count = 1;

                          newList.push(fullContact);
                          needsSort = true;
                      }
                  }
              }
          }
      }

      if (needsSort) {
          setContacts(sortContacts(newList));
      } else {
          setContacts(newList);
      }

  }, [contacts, sortContacts, user?.company_id]);

  const refreshList = async () => {
      if (!user?.company_id) return;
      
      try {
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

          setContacts(formatted); // Já vem ordenado do banco
          setError(null);
      } catch (e: any) {
          console.error("ChatList Error:", e.message);
          setError(e.message);
      }
  };

  useEffect(() => {
    if (!user?.company_id) return;

    const init = async () => {
      setLoading(true);
      await refreshList();
      setLoading(false);
    };

    init();

    // CHANNEL 1: Contatos
    const contactsChannel = supabase.channel(`chat-list-contacts:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          if (payload.eventType === 'UPDATE') {
              updatesBuffer.current.set(payload.new.jid, { type: 'contact_update', data: payload.new });
          } 
          // Não tratamos INSERT aqui porque INSERT em contacts geralmente vem acompanhado de mensagem
          // e o tratamento de mensagem (new_message) já cuida de buscar o contato.
      })
      .subscribe();

    // CHANNEL 2: Mensagens
    const messagesChannel = supabase.channel(`chat-list-messages:${user.company_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          updatesBuffer.current.set(payload.new.remote_jid, { type: 'new_message', data: payload.new });
      })
      .subscribe();

    // FLUSH LOOP: Processa o buffer a cada 1 segundo (Debounce Time)
    batchTimeoutRef.current = setInterval(() => {
        if (updatesBuffer.current.size > 0) processBuffer();
    }, 1000);

    return () => { 
        supabase.removeChannel(contactsChannel);
        supabase.removeChannel(messagesChannel);
        if (batchTimeoutRef.current) clearInterval(batchTimeoutRef.current);
    };
  }, [user?.company_id, processBuffer]); // Removido 'contacts' das deps para evitar re-subscribe infinito

  return { contacts, loading, error, refreshList };
}
