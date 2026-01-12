import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { TeamMember } from '@/types';

export function useTeam() {
  const { user } = useAuthStore();
  const supabase = createClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team_members', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, profile_pic_url')
        .eq('company_id', user.company_id);

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 5, // Cache de 5 min
  });

  return { members, isLoading };
}