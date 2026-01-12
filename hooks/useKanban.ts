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

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const queryKey = ['kanban', user?.company_id, selectedPipelineId];
  const pipelinesKey = ['pipelines', user?.company_id];

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: pipelinesKey,
    queryFn: async () => {
      if (!user?.company_id) return [];
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: !!user?.company_id,
  });

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
        const defaultPipe = pipelines.find(p => p.is_default) || pipelines[0];
        setSelectedPipelineId(defaultPipe.id);
    }
  }, [pipelines, selectedPipelineId]);

  // --- QUERY KANBAN ---
  const { data: kanbanData, isLoading: loadingBoard, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.company_id || !selectedPipelineId) return { columns: [], stages: [], allLeads: [] };

      try {
        const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', selectedPipelineId)
            .order('position');
        
        if (!stages || stages.length === 0) return { columns: [], stages: [], allLeads: [] };

        const stageIds = stages.map(s => s.id);
        const { data: leads } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user.company_id)
            .in('pipeline_stage_id', stageIds)
            .order('created_at', { ascending: false }); // Ordem cronológica para lista geral

        const allLeads = leads || [];

        // Monta colunas para o Kanban
        const board: KanbanColumn[] = stages.map((stage: PipelineStage) => {
            // Filtra e reordena por posição para o Kanban
            const stageLeads = allLeads
                .filter((l: Lead) => l.pipeline_stage_id === stage.id)
                .sort((a, b) => (a.position || 0) - (b.position || 0));

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

        // Lógica de Leads Órfãos (Para Admins)
        const isDefault = pipelines.find(p => p.id === selectedPipelineId)?.is_default;
        if (isDefault && (user.role === 'owner' || user.role === 'admin')) {
             const { data: orphans } = await supabase
                .from('leads')
                .select('*')
                .eq('company_id', user.company_id)
                .is('pipeline_stage_id', null);
             
             if (orphans && orphans.length > 0 && board.length > 0) {
                 board[0].items.unshift(...orphans);
                 allLeads.push(...orphans);
             }
        }

        return { columns: board, stages, allLeads };

      } catch (error) {
          console.error("Erro fatal no Kanban:", error);
          return { columns: [], stages: [], allLeads: [] };
      }
    },
    enabled: !!user?.company_id && !!selectedPipelineId,
  });

  // --- MUTATION: Mover Lead (Com Posição Inteligente) ---
  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId, newPosition }: { leadId: string; toStageId: string, newPosition: number }) => {
      const { error } = await supabase
        .from('leads')
        .update({ 
            pipeline_stage_id: toStageId,
            position: newPosition,
            updated_at: new Date().toISOString() 
        })
        .eq('id', leadId); 
      if (error) throw error;
    },
    onMutate: async ({ leadId, toStageId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<any>(queryKey);

      queryClient.setQueryData(queryKey, (old: any | undefined) => {
        if (!old || !old.columns) return old;
        
        // Deep clone para evitar mutação direta
        const newColumns = JSON.parse(JSON.stringify(old.columns));
        let newAllLeads = [...(old.allLeads || [])];
        
        let movedLead: Lead | undefined;

        // 1. Atualiza Colunas (Kanban View)
        for (const col of newColumns) {
          const idx = col.items.findIndex((l: Lead) => l.id === leadId);
          if (idx !== -1) {
            [movedLead] = col.items.splice(idx, 1);
            col.totalValue -= (Number(movedLead.value_potential) || 0);
            break;
          }
        }

        if (movedLead) {
          movedLead.pipeline_stage_id = toStageId;
          movedLead.position = newPosition;
          
          const targetCol = newColumns.find((c: KanbanColumn) => c.id === toStageId);
          if (targetCol) {
            targetCol.items.push(movedLead);
            targetCol.items.sort((a: Lead, b: Lead) => (a.position || 0) - (b.position || 0));
            targetCol.totalValue += (Number(movedLead.value_potential) || 0);
          }

          // 2. Atualiza Lista Geral (List View) para consistência
          newAllLeads = newAllLeads.map(l => 
            l.id === leadId ? { ...l, pipeline_stage_id: toStageId, position: newPosition } : l
          );
        }

        return { ...old, columns: newColumns, allLeads: newAllLeads };
      });
      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData);
      addToast({ type: 'error', title: 'Erro', message: 'Falha ao mover card.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Demais mutations mantidas...
  const reorderStagesMutation = useMutation({
      mutationFn: async (newOrder: { id: string, position: number }[]) => {
          const { error } = await supabase.rpc('reorder_pipeline_stages', { p_updates: newOrder });
          if(error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const createPipelineMutation = useMutation({
      mutationFn: async ({ name, stages, assignedUserIds }: { name: string, stages: string[], assignedUserIds: string[] }) => {
          if(!user?.company_id) throw new Error("Sem empresa");
          
          const { data: pipe, error: pipeError } = await supabase
            .from('pipelines')
            .insert({ company_id: user.company_id, name, is_default: false })
            .select()
            .single();
          
          if(pipeError) throw pipeError;

          const stagesPayload = stages.map((sName, idx) => ({
              pipeline_id: pipe.id,
              company_id: user.company_id,
              name: sName,
              position: idx,
              color: '#27272a'
          }));

          const { error: stagesError } = await supabase.from('pipeline_stages').insert(stagesPayload);
          if(stagesError) throw stagesError;

          if (assignedUserIds && assignedUserIds.length > 0) {
              const assignmentsPayload = assignedUserIds.map(userId => ({
                  pipeline_id: pipe.id,
                  user_id: userId
              }));
              await supabase.from('pipeline_assignments').insert(assignmentsPayload);
          }

          return pipe;
      },
      onSuccess: (newPipe) => {
          queryClient.invalidateQueries({ queryKey: pipelinesKey });
          setSelectedPipelineId(newPipe.id); 
          addToast({ type: 'success', title: 'Criado', message: `Funil "${newPipe.name}" criado com sucesso.` });
      }
  });

  const updateStageMutation = useMutation({
      mutationFn: async ({ id, name, color }: { id: string, name?: string, color?: string }) => {
          const updates: any = {};
          if(name) updates.name = name;
          if(color) updates.color = color;
          await supabase.from('pipeline_stages').update(updates).eq('id', id);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey })
  });

  const updatePipelineMutation = useMutation({
      mutationFn: async ({ id, name }: { id: string, name: string }) => {
          await supabase.from('pipelines').update({ name }).eq('id', id);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: pipelinesKey });
          addToast({ type: 'success', title: 'Atualizado', message: 'Nome do funil alterado.' });
      }
  });

  const createLead = async (data: any) => {
      const position = Date.now(); 
      const { error } = await supabase.from('leads').insert({ ...data, company_id: user?.company_id, position });
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
    columns: kanbanData?.columns || [], 
    allLeads: kanbanData?.allLeads || [], // Nova propriedade exposta
    stages: kanbanData?.stages || [],     // Nova propriedade exposta
    loading: loadingBoard || loadingPipelines, 
    moveLead: (leadId: string, toColId: string, newPosition: number) => moveLeadMutation.mutate({ leadId, toStageId: toColId, newPosition }),
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