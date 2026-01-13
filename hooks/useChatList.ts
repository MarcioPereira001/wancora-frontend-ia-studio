import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList(selectedSessionId: string | null) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Função auxiliar para formatar o preview da mensagem
  const formatMessagePreview = (content: string, type: string) => {
    if (!content && type !== 'text') {
        if (type === 'image') return '📷 Imagem';
        if (type === 'audio' || type === 'ptt') return '🎵 Áudio';
        if (type === 'video') return '🎥 Vídeo';
        if (type === 'document') return '📄 Documento';
        if (type === 'poll') return '📊 Enquete';
        if (type === 'location') return '📍 Localização';
    }
    // Tratamento JSON safe para enquetes
    if (type === 'poll' && typeof content === 'string' && content.startsWith('{')) {
        try {
            const pollData = JSON.parse(content);
            return `📊 ${pollData.name || 'Enquete'}`;
        } catch (e) { return '📊 Enquete'; }
    }
    return content;
  };

  useEffect(() => {
    if (!user?.company_id || !selectedSessionId) {
        setContacts([]); 
        setLoading(false);
        return;
    }

    const fetchChats = async () => {
      try {
        setLoading(true);
        
        // CHAMADA RPC OTIMIZADA
        // O Banco de dados faz o trabalho pesado de agrupar e ordenar
        const { data, error } = await supabase.rpc('get_my_chat_list', {
            p_company_id: user.company_id,
            p_session_id: selectedSessionId
        });

        if (error) throw error;

        // Mapeamento dos dados brutos da RPC para a interface ChatContact
        const mappedContacts: ChatContact[] = (data || []).map((row: any) => {
            // Prioridade de Nome: Contato > Lead > PushName > JID
            const displayName = row.contact_name || row.lead_name || row.contact_push_name || row.remote_jid.split('@')[0];
            
            // Prioridade de Foto: Lead (CRM) > Contato (WhatsApp)
            const displayPic = row.lead_pic || row.contact_pic;

            return {
                id: row.remote_jid, // Usamos remote_jid como ID único visual
                company_id: user.company_id,
                jid: row.remote_jid,
                remote_jid: row.remote_jid,
                name: displayName,
                push_name: row.contact_push_name,
                profile_pic_url: displayPic,
                unread_count: Number(row.unread_count),
                last_message: formatMessagePreview(row.last_message_content, row.last_message_type),
                last_message_time: row.last_message_time,
                phone_number: row.remote_jid.split('@')[0],
            };
        });

        setContacts(mappedContacts);

      } catch (err) {
        console.error('Erro crítico ao buscar lista de chats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();

    // REALTIME LISTENER
    // Mantemos o listener para atualizar a ordem quando chega mensagem nova
    const channel = supabase
      .channel(`chat-list-updates:${selectedSessionId}`)
      .on('postgres_changes', { 
        event: '*', // Escuta INSERT e UPDATE (status de leitura)
        schema: 'public', 
        table: 'messages',
        filter: `session_id=eq.${selectedSessionId}` 
      }, () => {
        // Debounce simples implícito pela natureza da rede, 
        // idealmente poderíamos otimizar, mas o refresh garante consistência.
        fetchChats(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.company_id, selectedSessionId, supabase]);

  return { contacts, loading };
}