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
    if (!user) return;
    
    const fetchContacts = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('*')
            // .eq('company_id', user.company_id) // If contacts are isolated
            .order('updated_at', { ascending: false });
            
        const formatted: ChatContact[] = (data || []).map((c: any) => ({
            id: c.jid,
            name: c.name || c.push_name || c.jid.split('@')[0],
            phone_number: c.jid.split('@')[0],
            remote_jid: c.jid,
            profile_pic_url: c.profile_pic_url,
            last_message: '...', // Need a proper join or view for this
            unread_count: 0
        }));
        
        setContacts(formatted);
        setLoading(false);
    };

    fetchContacts();
    
    // Realtime subscription could be added here
  }, [user]);

  return { contacts, loading };
}