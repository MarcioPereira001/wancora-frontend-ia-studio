
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

  // Função auxiliar de ordenação
  const sortContacts = (list: ChatContact[]) => {
      return list.sort((a, b) => {
          const tA = new Date(a.last_message_at || 0).getTime();
          const tB = new Date(b.last_message_at || 0).getTime();
          return tB - tA; // Mais recente primeiro
      });
  };

  const refreshList = async () => {
      if (!user?.company_id || criticalErrorRef.current) return;
      
      try {
          // Chamada RPC Otimizada (Lateral Join)
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) {
              console.error("ChatList RPC Error:", rpcError);
              if (rpcError.code === 'PGRST203' || rpcError.code === '42883') {
                  criticalErrorRef.current = true;
                  throw new Error(`Erro crítico de schema. Execute o SQL de atualização.`);
              }
              throw rpcError;
          }

          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              id: row.id || row.jid,
              last_message_time: row.last_message_at,
              phone_number: row.phone_number || row.remote_jid?.split('@')[0],
              name: row.name || null
          }));

          setContacts(formatted); // O SQL já retorna ordenado
          setError(null);
      } catch (e: any) {
          console.error("ChatList Hook Error:", e.message);
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

    const channel = supabase.channel(`chat-list-sync:${user.company_id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'contacts', 
          filter: `company_id=eq.${user.company_id}` 
      }, (payload) => {
          if (criticalErrorRef.current) return;

          if (payload.eventType === 'UPDATE') {
              const updatedRow = payload.new;
              setContacts(prev => {
                  // 1. Remove a versão antiga do contato
                  const filtered = prev.filter(c => c.jid !== updatedRow.jid);
                  
                  // 2. Prepara o contato atualizado
                  // Precisamos preservar dados que não vêm no evento 'contacts' (como last_message_content se não mudou)
                  // Mas o 'contacts' agora tem 'last_message_at' atualizado pelo trigger.
                  
                  const existing = prev.find(c => c.jid === updatedRow.jid);
                  
                  const newItem: ChatContact = {
                      ...(existing || {}), // Mantém dados antigos
                      id: updatedRow.jid,
                      jid: updatedRow.jid,
                      company_id: updatedRow.company_id,
                      remote_jid: updatedRow.jid,
                      name: updatedRow.name || existing?.name,
                      push_name: updatedRow.push_name,
                      unread_count: updatedRow.unread_count,
                      last_message_at: updatedRow.last_message_at,
                      last_message_time: updatedRow.last_message_at,
                      profile_pic_url: updatedRow.profile_pic_url,
                      is_muted: updatedRow.is_muted,
                      is_online: updatedRow.is_online,
                      phone_number: updatedRow.phone || existing?.phone_number || '',
                      is_group: updatedRow.jid.includes('@g.us'),
                      is_newsletter: updatedRow.jid.includes('@newsletter')
                  };

                  // 3. Adiciona no TOPO (Move to Top)
                  const newList = [newItem, ...filtered];
                  
                  // 4. Reordena para garantir (caso haja delay de rede)
                  return sortContacts(newList);
              });
          } 
          else if (payload.eventType === 'INSERT') {
              // Se é um contato novo, refresh completo para garantir dados do Lead (Join)
              refreshList();
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.company_id]);

  return { contacts, loading, error, refreshList };
}
