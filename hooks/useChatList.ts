import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact } from '@/types';
import { cleanJid } from '@/lib/utils';

export function useChatList() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Normaliza JIDs (remove :1, :2, etc.)
  const normalizeJid = (jid: string) => {
      return jid.replace(/:[0-9]+@/, '@');
  };

  useEffect(() => {
    if (!user?.company_id) return;
    
    const fetchContacts = async () => {
        setLoading(true);
        // Busca contatos vinculados à empresa do usuário
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('company_id', user.company_id)
            .order('updated_at', { ascending: false });
            
        if (error) {
            console.error("Erro ao buscar contatos:", error);
            setLoading(false);
            return;
        }

        const formatted: ChatContact[] = (data || []).map((c: any) => ({
            id: c.id || c.jid,
            name: c.name || c.push_name || cleanJid(c.jid),
            phone_number: cleanJid(c.jid),
            remote_jid: normalizeJid(c.jid),
            profile_pic_url: c.profile_pic_url,
            last_message: c.last_message_content || '...',
            last_message_time: c.last_message_time,
            unread_count: 0 // Implementar lógica de contagem real se houver tabela de unread
        }));
        
        setContacts(formatted);
        setLoading(false);
    };

    fetchContacts();
    
    // Inscrição no Realtime para atualizações instantâneas da lista
    const subscription = supabase
        .channel(`company_contacts:${user.company_id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'contacts',
            filter: `company_id=eq.${user.company_id}`
        }, () => {
            fetchContacts();
        })
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'contacts',
            filter: `company_id=eq.${user.company_id}`
        }, () => {
            fetchContacts();
        })
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
  }, [user?.company_id, supabase]);

  return { contacts, loading };
}