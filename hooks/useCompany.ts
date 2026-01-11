import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';

export function useCompany() {
  const { user } = useAuthStore();
  const supabase = createClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return null;
      // Mocking company table response or fetching from metadata
      return {
          id: user.company_id,
          name: 'Minha Empresa', // Replace with actual fetch if table exists
          plan: 'pro'
      };
    },
    enabled: !!user?.company_id
  });

  return { company, isLoading };
}