
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const criticalErrorRef = useRef(false);

  // Função de Ordenação Estrita (Mais recente -> Mais antigo)
  const sortContacts = (list: ChatContact[]) => {
      return [...list].sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; 
      });
  };

  const refreshList = async () => {
      if (!user?.company_id || criticalErrorRef.current) return;
      
      try {
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) throw rpcError;

          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              id: row.jid, // Usa JID como ID único
              last_message_time: row.last_message_at,
              phone_number: row.phone_number || row.remote_jid?.split('@')[0],
              name: row.name || null
          }));

          setContacts(formatted); // Já vem ordenado do SQL, mas o React pode precisar reordenar nos updates
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

    // CHANNEL 1: Contatos (Mudança de Ordem, Foto, Unread)
    const contactsChannel = supabase.channel(`chat-list-contacts:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new;
              setContacts(prev => {
                  // Encontra o item existente para preservar dados que não vieram no payload
                  const existingIndex = prev.findIndex(c => c.jid === updatedRow.jid);
                  const existing = existingIndex >= 0 ? prev[existingIndex] : null;

                  // Se o contato foi "ignorado" (removido do CRM), remove da lista
                  if (updatedRow.is_ignored) {
                      return prev.filter(c => c.jid !== updatedRow.jid);
                  }

                  const newItem: ChatContact = {
                      ...(existing || {}),
                      id: updatedRow.jid,
                      jid: updatedRow.jid,
                      company_id: updatedRow.company_id,
                      remote_jid: updatedRow.jid,
                      // Lógica de fallback visual
                      name: updatedRow.name || updatedRow.verified_name || updatedRow.push_name || existing?.name,
                      push_name: updatedRow.push_name,
                      unread_count: updatedRow.unread_count,
                      last_message_at: updatedRow.last_message_at, // O Trigger do banco atualiza isso
                      last_message_time: updatedRow.last_message_at,
                      profile_pic_url: updatedRow.profile_pic_url,
                      is_muted: updatedRow.is_muted,
                      is_online: updatedRow.is_online,
                      phone_number: updatedRow.phone || existing?.phone_number || '',
                      is_group: updatedRow.jid.includes('@g.us'),
                      is_newsletter: updatedRow.jid.includes('@newsletter')
                  };

                  // Remove versão antiga e adiciona nova
                  const filtered = prev.filter(c => c.jid !== updatedRow.jid);
                  // Reordena tudo
                  return sortContacts([newItem, ...filtered]);
              });
          } else if (payload.eventType === 'INSERT') {
              refreshList(); // Novo contato requer dados do Lead (Join), melhor recarregar
          }
      })
      .subscribe();

    // CHANNEL 2: Mensagens (Para garantir "Move to Top" imediato)
    const messagesChannel = supabase.channel(`chat-list-messages:${user.company_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          const newMsg = payload.new;
          setContacts(prev => {
              const targetJid = newMsg.remote_jid;
              const existingIndex = prev.findIndex(c => c.jid === targetJid);
              
              if (existingIndex === -1) return prev; // Se não está na lista (ex: novo contato), o Insert do contacts vai lidar

              const contact = { ...prev[existingIndex] };
              
              // Atualização Otimista
              contact.last_message_content = newMsg.content;
              contact.last_message_type = newMsg.message_type;
              contact.last_message_at = newMsg.created_at;
              contact.last_message_time = newMsg.created_at;
              
              if (!newMsg.from_me) {
                  contact.unread_count = (contact.unread_count || 0) + 1;
              }

              // Remove e põe no topo
              const others = prev.filter(c => c.jid !== targetJid);
              return [contact, ...others];
          });
      })
      .subscribe();

    return () => { 
        supabase.removeChannel(contactsChannel);
        supabase.removeChannel(messagesChannel);
    };
  }, [user?.company_id]);

  return { contacts, loading, error, refreshList };
}
