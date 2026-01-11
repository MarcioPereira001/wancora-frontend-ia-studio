import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';

export function useCompany() {
  const { user } = useAuthStore();
  const supabase = createClient();

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company_details', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();

      if (error) {
          console.error("Erro ao buscar dados da empresa:", error);
          throw error;
      }

      return data;
    },
    enabled: !!user?.company_id, // Só roda se tiver usuário logado com empresa
    staleTime: 1000 * 60 * 10, // Cache de 10 minutos
  });

  return { 
    company, 
    companyId: user?.company_id, // Atalho útil
    isLoading,
    isError: !!error 
  };
}