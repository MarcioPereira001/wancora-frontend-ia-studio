import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Lead } from '@/types/crm';

export function useLeadData(leadId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!leadId) {
        setLead(null);
        return;
    }

    const fetchLead = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (!error && data) {
        setLead(data);
      }
      setLoading(false);
    };

    fetchLead();
  }, [leadId]);

  return { lead, loading };
}