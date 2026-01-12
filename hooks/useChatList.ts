import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

// Agora aceita selectedSessionId como parâmetro
export function useChatList(selectedSessionId: string | null) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id || !selectedSessionId) {
        setContacts([]); // Se não tiver instância selecionada, limpa a lista
        setLoading(false);
        return;
    }

    const fetchChats = async () => {
      try {
        setLoading(true);
        
        // 1. Busca mensagens FILTRANDO PELA SESSÃO (session_id)
        const { data: messages, error } = await supabase
          .from('messages')
          .select(`
            remote_jid,
            content,
            created_at,
            message_type,
            from_me,
            status,
            leads (name, profile_pic_url),
            contacts (name, push_name, profile_pic_url)
          `)
          .eq('company_id', user.company_id)
          .eq('session_id', selectedSessionId) // <--- O PULO DO GATO 🐱
          .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Agrupa por conversa
        const chatMap = new Map<string, ChatContact>();

        messages?.forEach((msg: any) => {
          if (!chatMap.has(msg.remote_jid)) {
            const contactName = msg.contacts?.name || msg.contacts?.push_name;
            const leadName = msg.leads?.name;
            const phoneName = msg.remote_jid.split('@')[0];
            const displayName = contactName || leadName || phoneName;
            const displayPic = msg.contacts?.profile_pic_url || msg.leads?.profile_pic_url;

            let preview = msg.content;
            const type = msg.message_type || (msg as any).type;
            
            if (!preview && type !== 'text') {
                if (type === 'image') preview = '📷 Imagem';
                else if (type === 'audio') preview = '🎵 Áudio';
                else if (type === 'video') preview = '🎥 Vídeo';
                else if (type === 'document') preview = '📄 Documento';
                else if (type === 'poll') preview = '📊 Enquete';
            }

            if (type === 'poll' && typeof preview === 'string' && preview.startsWith('{')) {
                try {
                    const pollData = JSON.parse(preview);
                    preview = `📊 ${pollData.name || 'Enquete'}`;
                } catch (e) { preview = '📊 Enquete'; }
            }

            chatMap.set(msg.remote_jid, {
              id: msg.remote_jid,
              company_id: user.company_id,
              jid: msg.remote_jid,
              remote_jid: msg.remote_jid,
              name: displayName,
              push_name: msg.contacts?.push_name,
              profile_pic_url: displayPic,
              unread_count: 0,
              last_message: preview,
              last_message_time: msg.created_at,
              phone_number: phoneName,
              // session_id: selectedSessionId // Útil se precisar debugar
            });
          }
        });

        setContacts(Array.from(chatMap.values()));

      } catch (err) {
        console.error('Erro ao buscar lista de chats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();

    // 3. Realtime com Filtro de Sessão
    const channel = supabase
      .channel(`chat-list:${selectedSessionId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `session_id=eq.${selectedSessionId}` // Só atualiza se for desta instância
      }, () => {
        fetchChats(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.company_id, selectedSessionId, supabase]);

  return { contacts, loading };
}