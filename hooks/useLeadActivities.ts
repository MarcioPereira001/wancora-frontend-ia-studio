import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { LeadActivity } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';

export function useLeadActivities(leadId?: string) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId || !user?.company_id) return;

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
            .from('lead_activities')
            .select(`
                *,
                profiles:created_by (name)
            `)
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false }); // Mais recentes primeiro

        if (error) throw error;

        // Map para ter creator_name fácil
        const formatted = (data || []).map(item => ({
            ...item,
            creator_name: item.profiles?.name || 'Sistema'
        }));
        
        setActivities(formatted);
      } catch (e) {
          console.error("Erro fetch activities:", e);
      } finally {
          setLoading(false);
      }
    };

    fetchActivities();

    // Realtime Listener
    const channel = supabase.channel(`activities:${leadId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'lead_activities', 
            filter: `lead_id=eq.${leadId}` 
        }, async (payload) => {
            // Busca o nome do criador para o novo item
            let creatorName = 'Sistema';
            if(payload.new.created_by) {
                const { data } = await supabase.from('profiles').select('name').eq('id', payload.new.created_by).single();
                if(data) creatorName = data.name;
            }

            const newActivity = { ...payload.new, creator_name: creatorName } as LeadActivity;
            setActivities(prev => [newActivity, ...prev]);
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId, user?.company_id]);

  // Actions
  const addNote = async (content: string) => {
      if(!leadId || !user?.company_id) return;
      
      const { error } = await supabase.from('lead_activities').insert({
          company_id: user.company_id,
          lead_id: leadId,
          type: 'note',
          content,
          created_by: user.id
      });

      if (error) {
          console.error(error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar nota.' });
      } else {
          addToast({ type: 'success', title: 'Nota salva', message: 'Anotação registrada.' });
      }
  };

  const logSystemActivity = async (content: string) => {
      if(!leadId || !user?.company_id) return;
      // Logs de sistema podem não ter created_by ou usar o usuário atual se foi uma ação dele
      await supabase.from('lead_activities').insert({
          company_id: user.company_id,
          lead_id: leadId,
          type: 'log',
          content,
          created_by: user.id
      });
  };

  return { activities, loading, addNote, logSystemActivity };
}