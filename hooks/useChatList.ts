import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) return;

    const fetchChats = async () => {
      try {
        setLoading(true);
        
        // 1. Busca mensagens recentes com Joins para Leads e Contatos
        // Nota: Isso assume que existem Foreign Keys configuradas no Supabase entre:
        // messages.lead_id -> leads.id
        // messages.remote_jid -> contacts.jid (Se não houver FK estrita, os campos virão null, o que tratamos abaixo)
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
          .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Agrupa por conversa (remote_jid) usando um Map para garantir unicidade
        const chatMap = new Map<string, ChatContact>();

        messages?.forEach((msg: any) => {
          if (!chatMap.has(msg.remote_jid)) {
            
            // Lógica de Prioridade de Nome:
            // 1. Nome Salvo na Agenda/Grupo (contact.name)
            // 2. Nome Público do WhatsApp (contact.push_name)
            // 3. Nome no CRM (lead.name)
            // 4. Número formatado
            const contactName = msg.contacts?.name || msg.contacts?.push_name;
            const leadName = msg.leads?.name;
            const phoneName = msg.remote_jid.split('@')[0];
            
            const displayName = contactName || leadName || phoneName;

            // Prioridade de Foto:
            const displayPic = msg.contacts?.profile_pic_url || msg.leads?.profile_pic_url;

            // Formatação do Preview da Mensagem
            let preview = msg.content;
            const type = msg.message_type || (msg as any).type;
            
            if (!preview && type !== 'text') {
                if (type === 'image') preview = '📷 Imagem';
                else if (type === 'audio') preview = '🎵 Áudio';
                else if (type === 'video') preview = '🎥 Vídeo';
                else if (type === 'document') preview = '📄 Documento';
                else if (type === 'sticker') preview = '👾 Figurinha';
                else if (type === 'poll') preview = '📊 Enquete';
                else if (type === 'location') preview = '📍 Localização';
            }

            // Tratamento especial para enquetes (JSON)
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
              unread_count: 0, // Implementar lógica de count se necessário
              last_message: preview,
              last_message_time: msg.created_at,
              phone_number: phoneName
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

    // 3. Realtime Updates
    const channel = supabase
      .channel(`chat-list-realtime:${user.company_id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `company_id=eq.${user.company_id}`
      }, (payload) => {
        // Atualização simples: recarrega para reordenar
        // Poderia ser otimizado para inserir no topo do estado local
        fetchChats(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [user?.company_id, supabase]);

  return { contacts, loading };
}