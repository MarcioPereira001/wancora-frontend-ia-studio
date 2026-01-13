import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

// Agora aceita selectedSessionId como parâmetro obrigatório para isolamento
export function useChatList(selectedSessionId: string | null) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se não tiver instância selecionada, não carregamos nada para evitar vazamento de dados
    if (!user?.company_id || !selectedSessionId) {
        setContacts([]); 
        setLoading(false);
        return;
    }

    const fetchChats = async () => {
      try {
        setLoading(true);
        
        // 1. Busca mensagens FILTRANDO PELA SESSÃO (session_id)
        // Buscamos um volume maior para garantir que pegamos as últimas conversas ativas
        // O JOIN com contacts e leads é essencial para a foto de perfil
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
            contacts (name, push_name, profile_pic_url, is_ignored)
          `)
          .eq('company_id', user.company_id)
          .eq('session_id', selectedSessionId) // <--- FILTRO CRÍTICO
          .order('created_at', { ascending: false })
          .limit(200); // Aumentado para pegar mais conversas recentes no agrupamento

        if (error) throw error;

        // 2. Agrupa por conversa (remote_jid) usando Map para garantir unicidade
        const chatMap = new Map<string, ChatContact>();

        messages?.forEach((msg: any) => {
          if (!chatMap.has(msg.remote_jid)) {
            // Prioridade de Dados: Contact (WhatsApp Real) > Lead (CRM) > JID
            const contactData = msg.contacts;
            const leadData = msg.leads;

            const displayName = contactData?.push_name || contactData?.name || leadData?.name || msg.remote_jid.split('@')[0];
            // Foto: Prioriza contato (WhatsApp atualizado), depois lead, ou null
            const displayPic = contactData?.profile_pic_url || leadData?.profile_pic_url;

            let preview = msg.content;
            const type = msg.message_type || (msg as any).type;
            
            // Tratamento de preview para tipos não textuais
            if (!preview && type !== 'text') {
                if (type === 'image') preview = '📷 Imagem';
                else if (type === 'audio' || type === 'ptt') preview = '🎵 Áudio';
                else if (type === 'video') preview = '🎥 Vídeo';
                else if (type === 'document') preview = '📄 Documento';
                else if (type === 'poll') preview = '📊 Enquete';
                else if (type === 'location') preview = '📍 Localização';
            }

            // Tratamento JSON safe
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
              push_name: contactData?.push_name,
              profile_pic_url: displayPic,
              unread_count: 0, // TODO: Implementar contador real via RPC count
              last_message: preview,
              last_message_time: msg.created_at,
              phone_number: msg.remote_jid.split('@')[0],
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

    // 3. Realtime com Filtro de Sessão Específico
    // Escuta novas mensagens para atualizar a lista lateral (subir conversa pro topo)
    const channel = supabase
      .channel(`chat-list:${selectedSessionId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `session_id=eq.${selectedSessionId}` 
      }, (payload) => {
        // Quando chega mensagem nova, recarrega a lista para reordenar
        // Otimização futura: Atualizar o Map localmente sem fetch
        fetchChats(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.company_id, selectedSessionId, supabase]);

  return { contacts, loading };
}