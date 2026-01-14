import { useState, useEffect, useCallback } from 'react';
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
        const typeMap: Record<string, string> = {
            image: '📷 Imagem',
            audio: '🎵 Áudio',
            ptt: '🎤 Voz',
            video: '🎥 Vídeo',
            document: '📄 Documento',
            poll: '📊 Enquete',
            location: '📍 Localização',
            sticker: '👾 Figurinha',
            contact: '👤 Contato',
            pix: '💲 Pix'
        };
        return typeMap[type] || 'Mensagem';
    }
    return content;
  };

  const fetchChats = useCallback(async () => {
    if (!user?.company_id) {
        setRawContacts([]); 
        setLoading(false);
        return;
    }

    try {
      const { data, error } = await supabase.rpc('get_my_chat_list', {
          p_company_id: user.company_id,
          p_session_id: selectedSessionId || null 
      });

      if (error) throw error;

      const mappedContacts: ChatContact[] = (data || [])
        // FILTRO CRÍTICO: Remove duplicatas de LID (@lid) visualmente
        .filter((row: any) => !row.remote_jid.includes('@lid'))
        .map((row: any) => {
          const displayPic = row.contact_pic || row.lead_pic;
          
          // Usa a função centralizada de hierarquia
          const finalName = getDisplayName({
              is_group: row.is_group,
              name: row.contact_name, // Nome salvo na agenda (contacts.name)
              push_name: row.contact_push_name, // Nome do perfil
              remote_jid: row.remote_jid
          });

          return {
              id: row.remote_jid, 
              company_id: user.company_id,
              jid: row.remote_jid,
              remote_jid: row.remote_jid,
              name: finalName,
              push_name: row.contact_push_name,
              profile_pic_url: displayPic,
              unread_count: Number(row.unread_count || 0),
              last_message: formatMessagePreview(row.last_message_content, row.last_message_type),
              last_message_time: row.last_message_time,
              phone_number: row.remote_jid.split('@')[0],
              is_muted: row.is_muted || false,
              is_group: row.is_group || false,
              updated_at: row.contact_updated_at || new Date().toISOString()
          };
      });

      // Deduplicação Frontend Adicional (Safety Net)
      const uniqueMap = new Map();
      mappedContacts.forEach(c => {
          // Se já existe um contato com esse número (mesmo que JID diferente), preserva o mais recente
          // Isso ajuda caso o filtro de LID falhe ou venha outro formato
          const key = c.phone_number; 
          if (!uniqueMap.has(key)) {
              uniqueMap.set(key, c);
          }
      });
      const uniqueList = Array.from(uniqueMap.values());

      setRawContacts(uniqueList);

    } catch (err) {
      console.error('Erro chat list:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, selectedSessionId]);

  useEffect(() => {
    fetchChats();

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

  }, [fetchChats, user?.company_id]);

  return { 
      contacts: rawContacts, 
      loading, 
      refreshChats: fetchChats 
  };
}