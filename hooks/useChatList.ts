
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
  // Armazena atualizações pendentes para processar em lote
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

  // Processador do Buffer (Debounced)
  const processBuffer = useCallback(() => {
      if (updatesBuffer.current.size === 0) return;

      setContacts(prev => {
          let newList = [...prev];
          const updates = updatesBuffer.current;

          updates.forEach((payload, jid) => {
              const existingIndex = newList.findIndex(c => c.jid === jid);
              const existing = existingIndex >= 0 ? newList[existingIndex] : null;

              // 1. UPDATE DE CONTATO
              if (payload.type === 'contact_update') {
                  const updatedRow = payload.data;
                  if (updatedRow.is_ignored) {
                      newList = newList.filter(c => c.jid !== jid);
                      return;
                  }

                  const newItem: ChatContact = {
                      ...(existing || {}),
                      id: updatedRow.jid,
                      jid: updatedRow.jid,
                      remote_jid: updatedRow.jid,
                      company_id: updatedRow.company_id,
                      name: updatedRow.name || updatedRow.verified_name || updatedRow.push_name || existing?.name,
                      push_name: updatedRow.push_name,
                      unread_count: updatedRow.unread_count,
                      last_message_at: updatedRow.last_message_at,
                      last_message_time: updatedRow.last_message_at,
                      profile_pic_url: updatedRow.profile_pic_url,
                      is_muted: updatedRow.is_muted,
                      is_online: updatedRow.is_online,
                      phone_number: updatedRow.phone || existing?.phone_number || updatedRow.jid.split('@')[0],
                      is_group: updatedRow.jid.includes('@g.us'),
                      is_community: updatedRow.is_community || false,
                      is_business: updatedRow.is_business
                  };
                  
                  // Remove antigo e adiciona novo (será reordenado)
                  if (existingIndex >= 0) newList.splice(existingIndex, 1);
                  newList.push(newItem);
              }
              
              // 2. NOVA MENSAGEM (Optimistic Top Move)
              else if (payload.type === 'new_message') {
                  const newMsg = payload.data;
                  if (existingIndex === -1) {
                      // Se o contato não existe na lista, forçamos um refresh total
                      // para garantir dados consistentes (ex: nome, foto) vindos do RPC
                      // Isso acontece na primeira mensagem de um novo contato
                      return; 
                  }

                  const contact = { ...newList[existingIndex] };
                  contact.last_message_content = newMsg.content;
                  contact.last_message_type = newMsg.message_type;
                  contact.last_message_at = newMsg.created_at;
                  contact.last_message_time = newMsg.created_at;
                  
                  if (!newMsg.from_me) {
                      contact.unread_count = (contact.unread_count || 0) + 1;
                  }

                  newList.splice(existingIndex, 1);
                  newList.push(contact);
              }
          });

          // Limpa buffer após processar
          updatesBuffer.current.clear();
          return sortContacts(newList);
      });
  }, [sortContacts]);

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
              // Adiciona ao buffer em vez de atualizar direto
              updatesBuffer.current.set(payload.new.jid, { type: 'contact_update', data: payload.new });
          } else if (payload.eventType === 'INSERT') {
              refreshList(); // Insert é raro (novo contato), vale refresh total
          }
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
          // Adiciona mensagem ao buffer
          updatesBuffer.current.set(payload.new.remote_jid, { type: 'new_message', data: payload.new });
      })
      .subscribe();

    // FLUSH LOOP: Processa o buffer a cada 1 segundo (Debounce Time)
    // Isso transforma 50 updates/s em 1 update/s, salvando a CPU do cliente.
    batchTimeoutRef.current = setInterval(processBuffer, 1000);

    return () => { 
        supabase.removeChannel(contactsChannel);
        supabase.removeChannel(messagesChannel);
        if (batchTimeoutRef.current) clearInterval(batchTimeoutRef.current);
    };
  }, [user?.company_id, processBuffer]);

  return { contacts, loading, error, refreshList };
}
