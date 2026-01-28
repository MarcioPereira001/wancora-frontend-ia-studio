
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
  
  // Ref para evitar retry loop infinito se o DB estiver quebrado
  const criticalErrorRef = useRef(false);

  const refreshList = async () => {
      if (!user?.company_id || criticalErrorRef.current) return;
      
      try {
          // Chamada RPC Única (Assinatura: p_company_id uuid)
          const { data, error: rpcError } = await supabase.rpc('get_my_chat_list', {
              p_company_id: user.company_id
          });

          if (rpcError) {
              console.error("ChatList RPC Raw Error:", rpcError);
              
              // Erros de estrutura (PGRST203, 42804 datatype mismatch, etc)
              if (rpcError.code === 'PGRST203' || rpcError.code === '42883' || rpcError.code === '42804') {
                  criticalErrorRef.current = true;
                  throw new Error(`Erro crítico de banco de dados (Schema Mismatch: ${rpcError.message}). Execute o SQL de correção.`);
              }
              throw rpcError;
          }

          const formatted: ChatContact[] = (data || []).map((row: any) => ({
              ...row,
              id: row.id || row.jid, // Fallback para JID se ID vier nulo
              last_message_time: row.last_message_at,
              phone_number: row.phone_number || row.remote_jid.split('@')[0],
              name: row.name || null
          }));

          setContacts(formatted);
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
                  const exists = prev.find(c => c.jid === updatedRow.jid);
                  if (exists) {
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
                                  is_online: updatedRow.is_online
                              };
                          }
                          return c;
                      });
                      return updatedList.sort((a, b) => {
                          const tA = new Date(a.last_message_at || 0).getTime();
                          const tB = new Date(b.last_message_at || 0).getTime();
                          return tB - tA;
                      });
                  } else {
                      // Se é um contato novo que acabou de receber mensagem, recarrega
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

  return { contacts, loading, error, refreshList };
}
