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
        if (type === 'pix') return '💲 Pix';
    }
    return content;
  };

  const fetchChats = async () => {
    if (!user?.company_id) {
        setRawContacts([]); 
        setLoading(false);
        return;
    }

    try {
      // setLoading(true); // Removemos loading agressivo para evitar piscar na tela em updates
      
      // Se não tiver session_id selecionado, busca de todos (visão geral)
      const { data, error } = await supabase.rpc('get_my_chat_list', {
          p_company_id: user.company_id,
          p_session_id: selectedSessionId || undefined 
      });

      if (error) throw error;

      const mappedContacts: ChatContact[] = (data || []).map((row: any) => {
          const displayPic = row.lead_pic || row.contact_pic;
          
          // Lógica aprimorada para evitar "Novo Contato" se tiver push_name
          let finalName = row.contact_name;
          if (!finalName || finalName.includes('Novo Contato')) {
              finalName = row.contact_push_name || row.lead_name || row.contact_name;
          }

          const tempContact = {
              is_group: row.is_group,
              name: finalName,
              push_name: row.contact_push_name,
              remote_jid: row.remote_jid
          };

          return {
              id: row.remote_jid,
              company_id: user.company_id,
              jid: row.remote_jid,
              remote_jid: row.remote_jid,
              name: getDisplayName(tempContact),
              push_name: row.contact_push_name,
              profile_pic_url: displayPic,
              unread_count: Number(row.unread_count),
              last_message: formatMessagePreview(row.last_message_content, row.last_message_type),
              last_message_time: row.last_message_time,
              phone_number: row.remote_jid.split('@')[0],
              is_muted: row.is_muted,
              is_group: row.is_group,
              updated_at: row.contact_updated_at || new Date().toISOString()
          };
      });

      setRawContacts(mappedContacts);

    } catch (err) {
      console.error('Erro chat list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // REALTIME IMPROVED: Escuta qualquer mudança em mensagens ou contatos desta empresa
    const channel = supabase
      .channel(`chat-list-global:${user?.company_id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `company_id=eq.${user?.company_id}` 
      }, () => fetchChats())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contacts',
        filter: `company_id=eq.${user?.company_id}`
      }, () => fetchChats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.company_id, selectedSessionId]);

  return { 
      contacts: rawContacts, 
      loading, 
      refreshChats: fetchChats 
  };
}