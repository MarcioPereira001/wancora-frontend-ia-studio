
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Função isolada para recarregar tudo (usada em casos drásticos)
  const refreshList = async () => {
      if (!user?.company_id) return;
      try {
          const { data, error } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (error) throw error;

          // Mapping para garantir compatibilidade com componentes legados
          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              last_message_time: row.last_message_at, // Alias
              phone_number: row.phone_number || row.remote_jid.split('@')[0]
          }));

          setContacts(formatted);
      } catch (e) {
          console.error("ChatList RPC Error:", e);
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

    // REALTIME PATCHING
    // Escuta a tabela 'contacts'. Como temos um Trigger no banco que atualiza 'contacts'
    // sempre que chega mensagem, só precisamos ouvir esta tabela.
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
                      // PATCH LOCAL: Atualiza apenas o que mudou e reordena
                      const updatedList = prev.map(c => {
                          if (c.jid === updatedRow.jid) {
                              return {
                                  ...c,
                                  name: updatedRow.name || c.name,
                                  unread_count: updatedRow.unread_count,
                                  last_message_at: updatedRow.last_message_at,
                                  last_message_time: updatedRow.last_message_at,
                                  profile_pic_url: updatedRow.profile_pic_url,
                                  is_muted: updatedRow.is_muted,
                                  // Nota: last_message_content não vem no payload da tabela contacts (está em messages),
                                  // mas para performance, aceitamos que o conteúdo da msg atualize no próximo refresh ou 
                                  // implementamos um listener duplo se for crítico.
                                  // Para a lista subir, last_message_at é o que importa.
                              };
                          }
                          return c;
                      });

                      // Reordenação Javascript (Mais rápido que refetch)
                      return updatedList.sort((a, b) => {
                          const tA = new Date(a.last_message_at || 0).getTime();
                          const tB = new Date(b.last_message_at || 0).getTime();
                          return tB - tA;
                      });
                  } else {
                      // Se não existe (novo contato), faz fetch completo para garantir dados do Lead/Joins
                      refreshList();
                      return prev;
                  }
              });
          } 
          else if (payload.eventType === 'INSERT') {
              // Novo contato inserido -> Fetch para pegar dados completos
              refreshList();
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.company_id]);

  return { contacts, loading };
}
