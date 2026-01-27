
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

    const fetchContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('is_ignored', false)
          .order('last_message_at', { ascending: false });

        if (error) throw error;

        const formatted: ChatContact[] = (data || []).map((row: any) => ({
            id: row.id,
            company_id: row.company_id,
            jid: row.jid,
            remote_jid: row.jid,
            name: row.name || '',
            push_name: row.push_name,
            profile_pic_url: row.profile_pic_url,
            unread_count: row.unread_count || 0,
            last_message: row.last_message_content,
            last_message_content: row.last_message_content,
            last_message_type: row.last_message_type,
            last_message_time: row.last_message_at,
            phone_number: row.phone || row.jid.split('@')[0],
            is_muted: false,
            is_group: row.jid.includes('@g.us'),
            is_newsletter: row.jid.includes('@newsletter'),
            updated_at: row.updated_at,
            is_online: row.is_online,
            last_seen_at: row.last_seen_at
        }));

        setContacts(formatted);
      } catch (error) {
        console.error("Error fetching chats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();

    const channel = supabase.channel(`contacts-list:${user.company_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${user.company_id}` }, () => {
            fetchContacts();
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.company_id]);

  return { contacts, loading };
}
