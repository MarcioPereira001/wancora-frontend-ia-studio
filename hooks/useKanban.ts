import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Lead, KanbanColumn, PipelineStage } from '@/types';
import { useToast } from '@/hooks/useToast';

export function useKanban() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const queryKey = ['kanban', user?.company_id];

  // --- QUERY: Busca Pipeline Completo ---
  const { data: columns = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.company_id) return [];

      try {
        // 1. Busca Pipeline Padrão
        let { data: pipeline } = await supabase
            .from('pipelines')
            .select('id')
            .eq('company_id', user.company_id)
            .eq('is_default', true)
            .maybeSingle();

        // Se não existir pipeline padrão, pega qualquer um ou retorna vazio
        if (!pipeline) {
             const { data: anyPipeline } = await supabase
                .from('pipelines')
                .select('id')
                .eq('company_id', user.company_id)
                .limit(1)
                .maybeSingle();
             pipeline = anyPipeline;
        }

        if (!pipeline) return []; // Empresa sem pipeline configurado

        // 2. Busca Estágios
        const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', pipeline.id)
            .order('position');
        
        if (!stages || stages.length === 0) return [];

        // 3. Busca Leads
        const { data: leads } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user.company_id);

        const allLeads = leads || [];

        // 4. Monta Colunas
        const board: KanbanColumn[] = stages.map((stage: PipelineStage) => {
            const stageLeads = allLeads.filter((l: Lead) => l.stage_id === stage.id);
            // Calcula total monetário da coluna
            const totalValue = stageLeads.reduce((acc, lead) => acc + (Number(lead.value_potential) || 0), 0);
            
            return {
                id: stage.id,
                title: stage.name,
                color: stage.color,
                order: stage.position,
                totalValue,
                items: stageLeads
            };
        });

        // 5. Tratamento de Leads Órfãos (Sem estágio definido ou estágio deletado)
        // Isso acontece com o "Anti-Ghost" se o ID do estágio não for setado na criação
        const stageIds = new Set(stages.map(s => s.id));
        const orphanLeads = allLeads.filter((l: Lead) => !l.stage_id || !stageIds.has(l.stage_id));
        
        if (orphanLeads.length > 0 && board.length > 0) {
            // Adiciona órfãos na primeira coluna
            board[0].items.unshift(...orphanLeads);
            board[0].totalValue += orphanLeads.reduce((acc, l) => acc + (Number(l.value_potential) || 0), 0);
        }

        return board;

      } catch (error) {
          console.error("Erro fatal no Kanban:", error);
          return [];
      }
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 2, // 2 min cache
  });

  // --- MUTATION: Mover Lead (Optimistic Update) ---
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId }: { leadId: string; toStageId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('company_id', user?.company_id); 
      
      if (error) throw error;
      return { leadId, toStageId };
    },
    onMutate: async ({ leadId, toStageId }) => {
      // Cancela refetches em andamento
      await queryClient.cancelQueries({ queryKey });

      // Snapshot do estado anterior
      const previousBoard = queryClient.getQueryData<KanbanColumn[]>(queryKey);

      // Atualiza Cache Otimisticamente
      queryClient.setQueryData(queryKey, (old: KanbanColumn[] | undefined) => {
        if (!old) return [];
        
        // Deep clone para evitar mutação direta insegura
        const newBoard = old.map(col => ({
             ...col, 
             items: [...col.items] 
        }));

        let movedLead: Lead | undefined;

        // Remove da coluna antiga
        for (const col of newBoard) {
          const idx = col.items.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            // Atualiza total da coluna antiga (subtrai)
            col.totalValue -= (Number(movedLead.value_potential) || 0);
            break;
          }
        }

        // Adiciona na nova coluna
        if (movedLead) {
          movedLead.stage_id = toStageId;
          const targetCol = newBoard.find(c => c.id === toStageId);
          if (targetCol) {
            targetCol.items.push(movedLead); // Adiciona no final (ou poderia ser no topo)
            // Atualiza total da nova coluna (soma)
            targetCol.totalValue += (Number(movedLead.value_potential) || 0);
          }
        }

        return newBoard;
      });

      return { previousBoard };
    },
    onError: (err, newTodo, context) => {
      // Reverte se der erro
      if (context?.previousBoard) {
        queryClient.setQueryData(queryKey, context.previousBoard);
      }
      addToast({ type: 'error', title: 'Erro ao mover', message: 'Falha ao atualizar o estágio. Tente novamente.' });
    },
    onSettled: () => {
      // Sincroniza com o servidor para garantir consistência final
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // --- MUTATION: Criar Lead ---
  const createLeadMutation = useMutation({
      mutationFn: async (leadData: any) => {
          if (!user?.company_id) throw new Error("Sem empresa");
          const { error } = await supabase.from('leads').insert({
              ...leadData,
              company_id: user.company_id
          });
          if(error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey });
          addToast({ type: 'success', title: 'Sucesso', message: 'Lead criado.' });
      },
      onError: (e: any) => {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      }
  });

  return { 
    columns, 
    loading: isLoading, 
    moveLead: (leadId: string, toColId: string) => moveLeadMutation.mutate({ leadId, toStageId: toColId }),
    createLead: createLeadMutation.mutateAsync,
    refresh: refetch
  };
}