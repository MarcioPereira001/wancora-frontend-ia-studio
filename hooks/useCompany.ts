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
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();

      if (error) {
          console.error("Erro ao buscar empresa:", error);
          return null;
      }

      return {
          id: data.id,
          name: data.name,
          plan: data.plan || 'free',
          // Mapear outros campos conforme seu schema real
      };
    },
    enabled: !!user?.company_id
  });

  return { company, isLoading };
}