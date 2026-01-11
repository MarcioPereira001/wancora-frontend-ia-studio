import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message } from '@/types';
import { cleanJid } from '@/lib/utils';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper para normalizar JID
  const normalizeJid = (jid: string) => {
      if (!jid) return '';
      return jid.includes('@') ? jid.split('@')[0] : jid;
  };

  useEffect(() => {
    if (!user?.company_id) return;
    
    const fetchChatData = async () => {
        setLoading(true);

        try {
            // 1. Buscar Contatos (Source of Truth para Nomes e Fotos)
            const { data: contactsData, error: contactsError } = await supabase
                .from('contacts')
                .select('*')
                .eq('company_id', user.company_id);

            if (contactsError) throw contactsError;

            // 2. Buscar últimas mensagens (para montar a lista de conversas ativas)
            // Limitamos para performance. Em produção, idealmente usaríamos uma View Materializada.
            const { data: messagesData } = await supabase
                .from('messages')
                .select('remote_jid, content, created_at, message_type, from_me, status')
                .eq('company_id', user.company_id)
                .order('created_at', { ascending: false })
                .limit(500);

            // 3. Processamento e Merge
            const chatMap = new Map<string, ChatContact>();
            
            // Mapeia contatos conhecidos primeiro
            const contactDetailsMap = new Map();
            contactsData?.forEach((c: any) => {
                contactDetailsMap.set(cleanJid(c.jid), c);
            });

            if (messagesData) {
                messagesData.forEach((msg) => {
                    const cleanRemoteJid = cleanJid(msg.remote_jid);
                    
                    // Se já processamos este chat, pula (pois ordenamos por data desc, o primeiro é o mais recente)
                    if (chatMap.has(cleanRemoteJid)) return;

                    const contactInfo = contactDetailsMap.get(cleanRemoteJid);
                    
                    // Formata preview da mensagem
                    let preview = msg.content;
                    if (msg.message_type === 'image') preview = '📷 Imagem';
                    else if (msg.message_type === 'audio') preview = '🎵 Áudio';
                    else if (msg.message_type === 'video') preview = '🎥 Vídeo';
                    else if (msg.message_type === 'document') preview = '📄 Arquivo';
                    else if (msg.message_type === 'sticker') preview = '👾 Figurinha';

                    chatMap.set(cleanRemoteJid, {
                        jid: msg.remote_jid,
                        remote_jid: msg.remote_jid,
                        phone_number: cleanRemoteJid,
                        company_id: user.company_id,
                        name: contactInfo?.name || contactInfo?.push_name || cleanRemoteJid,
                        push_name: contactInfo?.push_name,
                        profile_pic_url: contactInfo?.profile_pic_url,
                        last_message: preview,
                        last_message_time: msg.created_at,
                        updated_at: msg.created_at,
                        unread_count: 0 // Implementar lógica de contagem depois se necessário
                    });
                });
            }

            const formatted = Array.from(chatMap.values());
            
            // Ordenar por mensagem mais recente
            formatted.sort((a, b) => {
                const dateA = new Date(a.last_message_time || 0).getTime();
                const dateB = new Date(b.last_message_time || 0).getTime();
                return dateB - dateA;
            });
            
            setContacts(formatted);

        } catch (error) {
            console.error("Erro ao carregar lista de chats:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchChatData();
    
    // Realtime subscriptions
    const channel = supabase
        .channel(`chat_list_main:${user.company_id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${user.company_id}` }, () => fetchChatData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${user.company_id}` }, () => fetchChatData())
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user?.company_id, supabase]);

  return { contacts, loading };
}