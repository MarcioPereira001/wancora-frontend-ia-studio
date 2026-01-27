
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
        // 1. Fetch Contacts (Agenda)
        const { data: contactsData, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('is_ignored', false)
          .order('last_message_at', { ascending: false });

        if (error) throw error;

        // 2. Fetch Leads (CRM) para enriquecer dados (Badge Novo, Status)
        // Otimização: Busca leads cujos telefones estão na lista de contatos
        const phones = contactsData
            .map((c: any) => c.phone)
            .filter((p: string | null) => p && p !== '0' && p.length > 5);

        let leadsMap = new Map();
        
        if (phones.length > 0) {
            // Em batch para performance
            const { data: leadsData } = await supabase
                .from('leads')
                .select('phone, created_at, status')
                .eq('company_id', user.company_id)
                .in('phone', phones);
            
            if (leadsData) {
                leadsData.forEach((l: any) => leadsMap.set(l.phone, l));
            }
        }

        const formatted: ChatContact[] = (contactsData || []).map((row: any) => {
            const leadInfo = leadsMap.get(row.phone);
            
            return {
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
                last_seen_at: row.last_seen_at,
                // Dados Injetados do Lead
                lead_created_at: leadInfo?.created_at || null,
                lead_status: leadInfo?.status || null
            };
        });

        setContacts(formatted);
      } catch (error) {
        console.error("Error fetching chats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();

    // Escuta mudanças em Contacts E Leads para atualizar badges em tempo real
    const contactSub = supabase.channel(`chat-list-contacts:${user.company_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${user.company_id}` }, () => {
            fetchContacts();
        })
        .subscribe();
        
    // Se um lead for criado, atualiza a lista para mostrar o badge "Novo"
    const leadSub = supabase.channel(`chat-list-leads:${user.company_id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `company_id=eq.${user.company_id}` }, () => {
            fetchContacts();
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(contactSub); 
        supabase.removeChannel(leadSub);
    };
  }, [user?.company_id]);

  return { contacts, loading };
}
