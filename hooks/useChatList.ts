import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';
import { getDisplayName } from '@/lib/utils';

export function useChatList(selectedSessionId: string | null) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [rawContacts, setRawContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Função auxiliar para formatar o preview da mensagem
  const formatMessagePreview = (content: string, type: string) => {
    if (!content && type !== 'text') {
        if (type === 'image') return '📷 Imagem';
        if (type === 'audio' || type === 'ptt' || type === 'voice') return '🎵 Áudio';
        if (type === 'video') return '🎥 Vídeo';
        if (type === 'document') return '📄 Documento';
        if (type === 'poll') return '📊 Enquete';
        if (type === 'location') return '📍 Localização';
        if (type === 'sticker') return '👾 Figurinha';
        if (type === 'contact') return '👤 Contato';
    }
    if (type === 'poll' && typeof content === 'string' && content.startsWith('{')) {
        try {
            const pollData = JSON.parse(content);
            return `📊 ${pollData.name || 'Enquete'}`;
        } catch (e) { return '📊 Enquete'; }
    }
    return content;
  };

  const fetchChats = async () => {
    if (!user?.company_id || !selectedSessionId) {
        setRawContacts([]); 
        setLoading(false);
        return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_my_chat_list', {
          p_company_id: user.company_id,
          p_session_id: selectedSessionId
      });

      if (error) throw error;

      const mappedContacts: ChatContact[] = (data || []).map((row: any) => {
          // Lógica de Foto: Lead (CRM) > Contato (WhatsApp)
          const displayPic = row.lead_pic || row.contact_pic;
          
          // Helper Object para usar a função getDisplayName
          const tempContact = {
              is_group: row.is_group,
              name: row.contact_name || row.lead_name, // Nome salvo no banco
              push_name: row.contact_push_name, // Nome do perfil
              remote_jid: row.remote_jid
          };

          return {
              id: row.remote_jid, // ID único visual
              company_id: user.company_id,
              jid: row.remote_jid,
              remote_jid: row.remote_jid,
              name: getDisplayName(tempContact), // Lógica centralizada
              push_name: row.contact_push_name,
              profile_pic_url: displayPic,
              unread_count: Number(row.unread_count),
              last_message: formatMessagePreview(row.last_message_content, row.last_message_type),
              last_message_time: row.last_message_time,
              phone_number: row.remote_jid.split('@')[0],
              is_muted: row.is_muted,
              is_group: row.is_group,
              // Data de criação para badge "Novo Lead" (usamos a data da primeira mensagem ou updated_at do contato se não houver lead)
              updated_at: row.contact_updated_at || new Date().toISOString()
          };
      });

      setRawContacts(mappedContacts);

    } catch (err) {
      console.error('Erro crítico ao buscar lista de chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // REALTIME: Escuta Mensagens (Update de última msg e contador) E Contatos (Update de nome/mute)
    // Isso garante que se chegar msg de contato novo, a lista atualiza
    const msgChannel = supabase
      .channel(`chat-list-msgs:${selectedSessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `session_id=eq.${selectedSessionId}` 
      }, () => fetchChats()) // Recarrega lista para reordenar
      .subscribe();

    const contactChannel = supabase
        .channel(`chat-list-contacts:${user?.company_id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'contacts',
            filter: `company_id=eq.${user?.company_id}`
        }, () => fetchChats())
        .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(contactChannel);
    };

  }, [user?.company_id, selectedSessionId]);

  return { 
      contacts: rawContacts, 
      loading, 
      refreshChats: fetchChats 
  };
}