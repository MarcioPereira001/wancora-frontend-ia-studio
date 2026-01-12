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

  // Buscar Pipeline, Estágios e Leads
  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['kanban', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];

      try {
        // 1. Buscar Pipeline Padrão
        let { data: pipeline, error: pipeError } = await supabase
            .from('pipelines')
            .select('*')
            .eq('company_id', user.company_id)
            .eq('is_default', true)
            .maybeSingle();

        if (pipeError && pipeError.code !== 'PGRST116') {
             console.error("Erro ao buscar pipeline:", pipeError);
             return [];
        }

        // AUTO-HEALING: Se não existir pipeline, criar um padrão
        if (!pipeline) {
            console.log("Tentando criar pipeline padrão...");
            const { data: newPipe, error: createError } = await supabase
                .from('pipelines')
                .insert({ company_id: user.company_id, name: 'Funil de Vendas', is_default: true })
                .select()
                .single();
            
            if (createError) {
                // SE DER ERRO (ex: 403 RLS), NÃO LANCE EXCEÇÃO, APENAS RETORNE VAZIO PARA PARAR O LOOP
                console.error("FALHA CRÍTICA: Não foi possível criar pipeline (Provável RLS):", createError);
                return []; 
            }
            
            pipeline = newPipe;
            
            if (pipeline) {
                const defaultStages = [
                    { pipeline_id: pipeline.id, name: 'Novos', position: 0, color: '#3b82f6', company_id: user.company_id },
                    { pipeline_id: pipeline.id, name: 'Qualificação', position: 1, color: '#eab308', company_id: user.company_id },
                    { pipeline_id: pipeline.id, name: 'Negociação', position: 2, color: '#f97316', company_id: user.company_id },
                    { pipeline_id: pipeline.id, name: 'Ganho', position: 3, color: '#22c55e', company_id: user.company_id }
                ];
                await supabase.from('pipeline_stages').insert(defaultStages);
            }
        }

        if (!pipeline) return [];

        // 2. Buscar Estágios do Pipeline
        const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', pipeline.id)
            .order('position');
        
        if (!stages) return [];

        // 3. Buscar Leads da Empresa
        const { data: leads } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user.company_id);

        return stages.map((stage: PipelineStage) => ({
            id: stage.id,
            title: stage.name,
            color: stage.color,
            order: stage.position,
            items: leads?.filter((l: Lead) => l.stage_id === stage.id) || []
        })) as KanbanColumn[];

      } catch (error) {
          console.error("Erro fatal no Kanban:", error);
          return [];
      }
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 5, // Aumentado para 5 minutos para evitar loops agressivos
    retry: 1 // Tenta apenas 1 vez em caso de erro
  });

  // Mover Lead (Drag & Drop)
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
      await queryClient.cancelQueries({ queryKey: ['kanban', user?.company_id] });
      const previousBoard = queryClient.getQueryData<KanbanColumn[]>(['kanban', user?.company_id]);

      queryClient.setQueryData(['kanban', user?.company_id], (old: KanbanColumn[] | undefined) => {
        if (!old) return [];
        const newCols = old.map(col => ({ ...col, items: col.items ? [...col.items] : [] }));
        
        let movedLead: Lead | undefined;
        for (const col of newCols) {
          if (!col.items) continue;
          const idx = col.items.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            break;
          }
        }
        if (movedLead) {
          movedLead.stage_id = toStageId;
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
      if (context?.previousBoard) {
        queryClient.setQueryData(['kanban', user?.company_id], context.previousBoard);
      }
      addToast({ type: 'error', title: 'Erro ao mover', message: 'Falha ao atualizar o estágio.' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban', user?.company_id] });
    },
  });

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
          queryClient.invalidateQueries({ queryKey: ['kanban', user?.company_id] });
      }
  });

  return { 
    columns, 
    loading: isLoading, 
    moveLead: (leadId: string, fromColId: string, toColId: string) => moveLeadMutation.mutate({ leadId, toStageId: toColId }),
    createLead: createLeadMutation.mutateAsync,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['kanban', user?.company_id] })
  };
}