import { useState, useMemo, useEffect } from 'react';
import { useCRMStore } from '@/store/useCRMStore';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KanbanColumn, Lead, Pipeline, PipelineStage } from '@/types';
import { useToast } from '@/hooks/useToast';

export function useKanban() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  // Consome a Store Global Realtime (Gaming Mode)
  const { leads: allLeads, stages, moveLeadOptimistic, isInitialized } = useCRMStore();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // --- 1. RESGATE: Busca de Pipelines (Faltava no novo) ---
  // Mantemos useQuery aqui pois pipelines mudam pouco e são metadados estruturais
  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines', user?.company_id],
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

  // Seleciona pipeline padrão automaticamente
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
        const defaultPipe = pipelines.find(p => p.is_default) || pipelines[0];
        setSelectedPipelineId(defaultPipe.id);
    }
  }, [pipelines, selectedPipelineId]);

  // --- 2. TRANSFORMAÇÃO DE DADOS (Com Tratamento de Órfãos) ---
  const columns = useMemo(() => {
      if (!stages.length) return [];

      const stageIds = new Set(stages.map(s => s.id));

      // Mapeia colunas normais
      const board: KanbanColumn[] = stages.map((stage: PipelineStage) => {
          const stageLeads = allLeads
              .filter(l => l.pipeline_stage_id === stage.id)
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

      // --- RESGATE: Lógica de Órfãos (Leads com estágio inválido) ---
      // Se não fizermos isso, leads com stage_id antigo somem da tela
      const orphans = allLeads.filter(l => !l.pipeline_stage_id || !stageIds.has(l.pipeline_stage_id));
      
      if (orphans.length > 0 && board.length > 0) {
          // Coloca visualmente na primeira coluna para não perder
          board[0].items.unshift(...orphans);
          board[0].totalValue += orphans.reduce((acc, l) => acc + (Number(l.value_potential) || 0), 0);
          
          // Auto-fix silencioso no banco (Fire and Forget)
          const firstStageId = board[0].id;
          orphans.forEach(async (lead) => {
             // Só atualiza no banco se o ID for diferente, para não loopar
             if (lead.pipeline_stage_id !== firstStageId) {
                 await supabase.from('leads').update({ pipeline_stage_id: firstStageId }).eq('id', lead.id);
             }
          });
      }

      return board;
  }, [allLeads, stages]);

  // --- ACTIONS (Optimistic + Server) ---

  const moveLeadMutation = useMutation({
    mutationFn: async ({ leadId, toStageId, newPosition }: { leadId: string; toStageId: string, newPosition: number }) => {
      // 1. Atualização Otimista (Store) - Instantâneo
      moveLeadOptimistic(leadId, toStageId, newPosition);

      // 2. Persistência (Server)
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
    onError: (err) => {
      console.error(err);
      addToast({ type: 'error', title: 'Erro', message: 'Falha ao mover card. Sincronizando...' });
      // Em caso de erro, forçamos um refresh total para garantir integridade
      useCRMStore.getState().initializeCRM(user?.company_id || '');
    }
  });

  // --- RESGATE: Reordenação Otimizada (RPC) ---
  const reorderStagesMutation = useMutation({
      mutationFn: async (newOrder: { id: string, position: number }[]) => {
          // Tenta RPC primeiro (Mais robusto/Atômico)
          try {
            const { error } = await supabase.rpc('reorder_pipeline_stages', { p_updates: newOrder });
            if(error) throw error;
          } catch(e) {
             // Fallback loop se a RPC falhar ou não existir
             for(const item of newOrder) {
                 await supabase.from('pipeline_stages').update({ position: item.position }).eq('id', item.id);
             }
          }
      }
      // Não precisamos de onSuccess invalidate, o Realtime do Postgres avisará a Store
  });

  // Mutações Padrão (Create/Update/Delete)
  // Nota: Não usamos mais invalidateQueries agressivo para leads/stages, pois o Socket atualiza a Store.
  // Apenas para Pipelines usamos invalidate, pois eles não estão na Store Global ainda.

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

          return pipe;
      },
      onSuccess: (newPipe) => {
          addToast({ type: 'success', title: 'Criado', message: `Funil "${newPipe.name}" criado.` });
          // Pipelines ainda usam React Query
          // queryClient.invalidateQueries({ queryKey: ['pipelines'] }) <- Se tivesse queryClient aqui
      }
  });

  const updateStageMutation = useMutation({
      mutationFn: async ({ id, name, color }: { id: string, name?: string, color?: string }) => {
          const updates: any = {};
          if(name) updates.name = name;
          if(color) updates.color = color;
          await supabase.from('pipeline_stages').update(updates).eq('id', id);
      }
  });

  const updatePipelineMutation = useMutation({
      mutationFn: async ({ id, name }: { id: string, name: string }) => {
          await supabase.from('pipelines').update({ name }).eq('id', id);
      },
      onSuccess: () => {
          addToast({ type: 'success', title: 'Atualizado', message: 'Funil renomeado.' });
      }
  });

  const createLead = async (data: any) => {
      const position = Date.now(); 
      const { error } = await supabase.from('leads').insert({ ...data, company_id: user?.company_id, position });
      if(error) throw error;
  };

  const updateLead = async ({id, data}: any) => {
      const { error } = await supabase.from('leads').update(data).eq('id', id);
      if(error) throw error;
  };

  const deleteLead = async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if(error) throw error;
  };

  return { 
    pipelines, // Agora retorna os pipelines reais
    selectedPipelineId,
    setSelectedPipelineId,
    columns, 
    allLeads,
    stages,
    loading: !isInitialized || loadingPipelines, 
    moveLead: (leadId: string, toColId: string, newPosition: number) => moveLeadMutation.mutate({ leadId, toStageId: toColId, newPosition }),
    reorderStages: reorderStagesMutation.mutate, // Volta a usar RPC
    createPipeline: createPipelineMutation.mutateAsync,
    updateStage: updateStageMutation.mutateAsync,
    updatePipeline: updatePipelineMutation.mutateAsync,
    createLead,
    updateLead,
    deleteLead,
    refresh: () => useCRMStore.getState().initializeCRM(user?.company_id || '')
  };
}
