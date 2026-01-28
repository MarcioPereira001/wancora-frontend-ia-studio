
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função isolada para recarregar tudo com tratamento de erro
  const refreshList = async () => {
      if (!user?.company_id) return;
      try {
          // Chamada RPC - Se a função no banco estiver quebrada (PGRST203), vai cair no catch
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) throw rpcError;

          // Mapping e Sanitização
          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              last_message_time: row.last_message_at, // Alias para UI
              phone_number: row.phone_number || row.remote_jid.split('@')[0],
              // Garante que name null seja mantido como null para a UI tratar
              name: row.name || null
          }));

          setContacts(formatted);
          setError(null);
      } catch (e: any) {
          console.error("ChatList RPC Error:", e.message);
          // Se for erro de ambiguidade (PGRST203), não adianta tentar de novo imediatamente
          if (e.code === 'PGRST203') {
              setError("Erro crítico no banco de dados. Contate o suporte.");
          }
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

    // REALTIME: Ouve apenas a tabela CONTACTS
    // O backend atualiza 'contacts' com last_message_at e unread_count via Trigger
    const channel = supabase.channel(`chat-list-sync:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          
          if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new;
              
              setContacts(prev => {
                  const exists = prev.find(c => c.jid === updatedRow.jid);
                  
                  if (exists) {
                      // PATCH LOCAL: Atualiza apenas o que mudou
                      const updatedList = prev.map(c => {
                          if (c.jid === updatedRow.jid) {
                              return {
                                  ...c,
                                  name: updatedRow.name || c.name, // Mantém local se vier null e já tiver
                                  unread_count: updatedRow.unread_count,
                                  last_message_at: updatedRow.last_message_at,
                                  last_message_time: updatedRow.last_message_at,
                                  profile_pic_url: updatedRow.profile_pic_url,
                                  is_muted: updatedRow.is_muted,
                                  is_online: updatedRow.is_online
                              };
                          }
                          return c;
                      });

                      // Reordenação Javascript (Bubbling Up)
                      return updatedList.sort((a, b) => {
                          const tA = new Date(a.last_message_at || 0).getTime();
                          const tB = new Date(b.last_message_at || 0).getTime();
                          return tB - tA; // Mais recente primeiro
                      });
                  } else {
                      // Se não existe na lista (novo contato ativo), faz fetch completo
                      refreshList();
                      return prev;
                  }
              });
          } 
          else if (payload.eventType === 'INSERT') {
              refreshList();
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.company_id]);

  return { contacts, loading, error };
}
