import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Lead, KanbanColumn } from '@/types';
import { useToast } from '@/hooks/useToast';

export function useKanban() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Buscar Pipeline e Leads
  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['kanban', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];

      // 1. Fetch Stages
      const { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', user.company_id)
        .order('position');
      
      if (stagesError) {
          console.error('Error fetching stages:', stagesError);
          return [];
      }

      // 2. Fetch Leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user.company_id);

      if (leadsError) {
          console.error('Error fetching leads:', leadsError);
          return [];
      }

      return stages.map((stage: any) => ({
        id: stage.id,
        title: stage.name,
        color: stage.color,
        order: stage.position,
        company_id: user.company_id,
        items: leads?.filter((l: Lead) => l.stage_id === stage.id) || []
      })) as KanbanColumn[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  // Mover Lead (Drag & Drop)
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId }: { leadId: string; toStageId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ stage_id: toStageId })
        .eq('id', leadId);
      
      if (error) throw error;
      return { leadId, toStageId };
    },
    onMutate: async ({ leadId, toStageId }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['kanban', user?.company_id] });
      
      // Snapshot do estado anterior
      const previousBoard = queryClient.getQueryData<KanbanColumn[]>(['kanban', user?.company_id]);

      // Atualização Otimista
      queryClient.setQueryData(['kanban', user?.company_id], (old: KanbanColumn[] | undefined) => {
        if (!old) return [];
        
        // Deep copy
        const newCols = old.map(col => ({ 
            ...col, 
            items: col.items ? [...col.items] : [] 
        }));
        
        let movedLead: Lead | undefined;
        
        // 1. Encontrar e remover da coluna antiga
        for (const col of newCols) {
          if (!col.items) continue;
          const idx = col.items.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            break;
          }
        }

        // 2. Adicionar na nova coluna
        if (movedLead) {
          movedLead.stage_id = toStageId; // Atualiza ID localmente
          const targetCol = newCols.find(c => c.id === toStageId);
          if (targetCol) {
            if (!targetCol.items) targetCol.items = [];
            targetCol.items.push(movedLead);
          }
        }

        return newCols;
      });

      return { previousBoard };
    },
    onError: (err, newTodo, context) => {
      // Rollback em caso de erro
      if (context?.previousBoard) {
        queryClient.setQueryData(['kanban', user?.company_id], context.previousBoard);
      }
      addToast({ type: 'error', title: 'Erro ao mover', message: 'Não foi possível salvar a alteração.' });
    },
    onSettled: () => {
      // Revalidar dados reais
      queryClient.invalidateQueries({ queryKey: ['kanban', user?.company_id] });
    },
  });

  return { 
    columns, 
    loading: isLoading, 
    moveLead: (leadId: string, fromColId: string, toColId: string) => moveLeadMutation.mutate({ leadId, toStageId: toColId }),
    refresh: () => queryClient.invalidateQueries({ queryKey: ['kanban', user?.company_id] })
  };
}