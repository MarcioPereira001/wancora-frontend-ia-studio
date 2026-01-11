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

      // 1. Buscar Pipeline Padrão
      let { data: pipeline } = await supabase
        .from('pipelines')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('is_default', true)
        .maybeSingle();

      // AUTO-HEALING: Se não existir pipeline, criar um padrão
      if (!pipeline) {
          console.log("Criando pipeline padrão para nova empresa...");
          const { data: newPipe, error: createError } = await supabase
            .from('pipelines')
            .insert({ company_id: user.company_id, name: 'Funil de Vendas', is_default: true })
            .select()
            .single();
          
          if (newPipe) {
              pipeline = newPipe;
              // Criar estágios padrão
              const defaultStages = [
                  { pipeline_id: newPipe.id, name: 'Novos', position: 0, color: '#3b82f6', company_id: user.company_id },
                  { pipeline_id: newPipe.id, name: 'Qualificação', position: 1, color: '#eab308', company_id: user.company_id },
                  { pipeline_id: newPipe.id, name: 'Negociação', position: 2, color: '#f97316', company_id: user.company_id },
                  { pipeline_id: newPipe.id, name: 'Ganho', position: 3, color: '#22c55e', company_id: user.company_id }
              ];
              await supabase.from('pipeline_stages').insert(defaultStages);
          } else if (createError) {
              console.error("Erro ao criar pipeline:", createError);
              return [];
          }
      }

      if (!pipeline) return [];

      // 2. Buscar Estágios do Pipeline
      const { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipeline.id)
        .order('position');
      
      if (stagesError) {
          console.error('Error fetching stages:', stagesError);
          return [];
      }

      // 3. Buscar Leads da Empresa
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user.company_id);

      if (leadsError) {
          console.error('Error fetching leads:', leadsError);
          return [];
      }

      return stages.map((stage: PipelineStage) => ({
        id: stage.id,
        title: stage.name,
        color: stage.color,
        order: stage.position,
        items: leads?.filter((l: Lead) => l.stage_id === stage.id) || []
      })) as KanbanColumn[];
    },
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });

  // Mover Lead (Drag & Drop)
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId }: { leadId: string; toStageId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('company_id', user?.company_id); // Segurança extra
      
      if (error) throw error;
      return { leadId, toStageId };
    },
    onMutate: async ({ leadId, toStageId }) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['kanban', user?.company_id] });
      const previousBoard = queryClient.getQueryData<KanbanColumn[]>(['kanban', user?.company_id]);

      queryClient.setQueryData(['kanban', user?.company_id], (old: KanbanColumn[] | undefined) => {
        if (!old) return [];
        const newCols = old.map(col => ({ ...col, items: col.items ? [...col.items] : [] }));
        
        let movedLead: Lead | undefined;
        // Remover da coluna antiga
        for (const col of newCols) {
          if (!col.items) continue;
          const idx = col.items.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            break;
          }
        }
        // Adicionar na nova
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

  // Criar Lead via Hook (opcional, pode ser via componente)
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