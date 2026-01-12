import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Lead, KanbanColumn, PipelineStage, Pipeline } from '@/types';
import { useToast } from '@/hooks/useToast';

export function useKanban() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Estado local para controlar qual pipeline está ativo
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const queryKey = ['kanban', user?.company_id, selectedPipelineId];
  const pipelinesKey = ['pipelines', user?.company_id];

  // --- QUERY: Listar Todos os Pipelines ---
  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: pipelinesKey,
    queryFn: async () => {
      if (!user?.company_id) return [];
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: true }); // Mais antigos primeiro (Default geralmente é o primeiro)
      
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: !!user?.company_id,
  });

  // Define o pipeline padrão automaticamente ao carregar
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
        const defaultPipe = pipelines.find(p => p.is_default) || pipelines[0];
        setSelectedPipelineId(defaultPipe.id);
    }
  }, [pipelines, selectedPipelineId]);

  // --- QUERY: Busca Dados do Kanban (Colunas + Leads) ---
  const { data: columns = [], isLoading: loadingBoard, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.company_id || !selectedPipelineId) return [];

      try {
        // 1. Busca Estágios do Pipeline Selecionado
        const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', selectedPipelineId)
            .order('position');
        
        if (!stages || stages.length === 0) return [];

        // 2. Busca Leads (apenas deste pipeline/estágios)
        // Otimização: Filtramos leads que tenham stage_id pertencente a estes estágios
        const stageIds = stages.map(s => s.id);
        const { data: leads } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user.company_id)
            .in('stage_id', stageIds);

        const allLeads = leads || [];

        // 3. Monta Colunas
        const board: KanbanColumn[] = stages.map((stage: PipelineStage) => {
            const stageLeads = allLeads.filter((l: Lead) => l.stage_id === stage.id);
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

        // 4. Tratamento de Leads Órfãos (Apenas se for o pipeline padrão)
        const isDefault = pipelines.find(p => p.id === selectedPipelineId)?.is_default;
        if (isDefault) {
             const { data: orphans } = await supabase
                .from('leads')
                .select('*')
                .eq('company_id', user.company_id)
                .is('stage_id', null);
             
             if (orphans && orphans.length > 0 && board.length > 0) {
                 board[0].items.unshift(...orphans);
             }
        }

        return board;

      } catch (error) {
          console.error("Erro fatal no Kanban:", error);
          return [];
      }
    },
    enabled: !!user?.company_id && !!selectedPipelineId,
  });

  // --- MUTATION: Mover Lead (Optimistic) ---
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId }: { leadId: string; toStageId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
        .eq('id', leadId); 
      if (error) throw error;
    },
    onMutate: async ({ leadId, toStageId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousBoard = queryClient.getQueryData<KanbanColumn[]>(queryKey);

      queryClient.setQueryData(queryKey, (old: KanbanColumn[] | undefined) => {
        if (!old) return [];
        const newBoard = old.map(col => ({ ...col, items: [...col.items] }));
        let movedLead: Lead | undefined;

        // Remove
        for (const col of newBoard) {
          const idx = col.items.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            col.totalValue -= (Number(movedLead.value_potential) || 0);
            break;
          }
        }
        // Adiciona
        if (movedLead) {
          movedLead.stage_id = toStageId;
          const targetCol = newBoard.find(c => c.id === toStageId);
          if (targetCol) {
            targetCol.items.push(movedLead);
            targetCol.totalValue += (Number(movedLead.value_potential) || 0);
          }
        }
        return newBoard;
      });
      return { previousBoard };
    },
    onError: (err, _, context) => {
      if (context?.previousBoard) queryClient.setQueryData(queryKey, context.previousBoard);
      addToast({ type: 'error', title: 'Erro', message: 'Falha ao mover card.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  // --- MUTATION: Reordenar Estágios ---
  const reorderStagesMutation = useMutation({
      mutationFn: async (newOrder: { id: string, position: number }[]) => {
          const { error } = await supabase.rpc('reorder_pipeline_stages', { p_updates: newOrder });
          if(error) throw error;
      },
      onMutate: async (newOrder) => {
          await queryClient.cancelQueries({ queryKey });
          const previousBoard = queryClient.getQueryData<KanbanColumn[]>(queryKey);
          
          queryClient.setQueryData(queryKey, (old: KanbanColumn[] | undefined) => {
              if(!old) return [];
              // Reordena localmente baseado no input
              const newBoard = [...old];
              newBoard.sort((a, b) => {
                  const posA = newOrder.find(x => x.id === a.id)?.position ?? a.order;
                  const posB = newOrder.find(x => x.id === b.id)?.position ?? b.order;
                  return posA - posB;
              });
              return newBoard;
          });
          return { previousBoard };
      },
      onError: (err, _, context) => {
          if (context?.previousBoard) queryClient.setQueryData(queryKey, context.previousBoard);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao reordenar colunas.' });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey })
  });

  // --- MUTATION: Criar Pipeline ---
  const createPipelineMutation = useMutation({
      mutationFn: async ({ name, stages }: { name: string, stages: string[] }) => {
          if(!user?.company_id) throw new Error("Sem empresa");
          
          // 1. Criar Pipeline
          const { data: pipe, error: pipeError } = await supabase
            .from('pipelines')
            .insert({ company_id: user.company_id, name, is_default: false })
            .select()
            .single();
          
          if(pipeError) throw pipeError;

          // 2. Criar Estágios
          const stagesPayload = stages.map((sName, idx) => ({
              pipeline_id: pipe.id,
              company_id: user.company_id,
              name: sName,
              position: idx,
              color: '#27272a' // Default color (zinc-800)
          }));

          const { error: stagesError } = await supabase.from('pipeline_stages').insert(stagesPayload);
          if(stagesError) throw stagesError;

          return pipe;
      },
      onSuccess: (newPipe) => {
          queryClient.invalidateQueries({ queryKey: pipelinesKey });
          setSelectedPipelineId(newPipe.id); // Troca para o novo automaticamente
          addToast({ type: 'success', title: 'Criado', message: `Funil "${newPipe.name}" criado.` });
      }
  });

  // --- MUTATION: Atualizar Estágio (Nome/Cor) ---
  const updateStageMutation = useMutation({
      mutationFn: async ({ id, name, color }: { id: string, name?: string, color?: string }) => {
          const updates: any = {};
          if(name) updates.name = name;
          if(color) updates.color = color;
          
          const { error } = await supabase.from('pipeline_stages').update(updates).eq('id', id);
          if(error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  // --- MUTATION: Atualizar Pipeline (Nome) ---
  const updatePipelineMutation = useMutation({
      mutationFn: async ({ id, name }: { id: string, name: string }) => {
          const { error } = await supabase.from('pipelines').update({ name }).eq('id', id);
          if(error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: pipelinesKey });
          addToast({ type: 'success', title: 'Atualizado', message: 'Nome do funil alterado.' });
      }
  });

  // Métodos CRUD de Leads
  const createLead = async (data: any) => {
      const { error } = await supabase.from('leads').insert({ ...data, company_id: user?.company_id });
      if(error) throw error;
      queryClient.invalidateQueries({ queryKey });
  };

  const updateLead = async ({id, data}: any) => {
      const { error } = await supabase.from('leads').update(data).eq('id', id);
      if(error) throw error;
      queryClient.invalidateQueries({ queryKey });
  };

  const deleteLead = async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if(error) throw error;
      queryClient.invalidateQueries({ queryKey });
  };

  return { 
    pipelines,
    selectedPipelineId,
    setSelectedPipelineId,
    columns, 
    loading: loadingBoard || loadingPipelines, 
    moveLead: (leadId: string, toColId: string) => moveLeadMutation.mutate({ leadId, toStageId: toColId }),
    reorderStages: reorderStagesMutation.mutate,
    createPipeline: createPipelineMutation.mutateAsync,
    updateStage: updateStageMutation.mutateAsync,
    updatePipeline: updatePipelineMutation.mutateAsync,
    createLead,
    updateLead,
    deleteLead,
    refresh: refetch
  };
}