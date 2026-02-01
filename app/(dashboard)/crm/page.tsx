
'use client';

import React, { useState } from 'react';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { LeadListView } from '@/components/crm/LeadListView';
import { Button } from '@/components/ui/button';
import { Plus, GitMerge, Edit2, Check, X, ChevronDown, LayoutDashboard, List, Upload } from 'lucide-react';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { NewPipelineModal } from '@/components/crm/NewPipelineModal';
import { ImportLeadsModal } from '@/components/crm/ImportLeadsModal'; // Novo Import
import { useKanban } from '@/hooks/useKanban';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore'; 
import { cn } from '@/lib/utils';

export default function CRMPage() {
  const { user } = useAuthStore();
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isPipeModalOpen, setIsPipeModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // State Import
  const [isEditingPipeName, setIsEditingPipeName] = useState(false);
  const [tempPipeName, setTempPipeName] = useState('');
  
  // View State (Kanban vs List)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  
  // Agora desestruturamos allLeads e stages também
  const { pipelines, selectedPipelineId, setSelectedPipelineId, updatePipeline, columns, allLeads, stages, refresh } = useKanban();

  const defaultStageId = columns.length > 0 ? columns[0].id : undefined;
  const currentPipeline = pipelines.find(p => p.id === selectedPipelineId);

  const handleUpdatePipeName = async () => {
      if(!currentPipeline || !tempPipeName.trim()) return;
      await updatePipeline({ id: currentPipeline.id, name: tempPipeName });
      setIsEditingPipeName(false);
  };

  const startEditPipe = () => {
      if(currentPipeline) {
          setTempPipeName(currentPipeline.name);
          setIsEditingPipeName(true);
      }
  };

  const isManager = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar Reformulada para Evitar Colisão */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          {/* Linha do Seletor e Botão de Edição */}
          <div className="flex items-center gap-3">
              {isEditingPipeName ? (
                  <div className="flex items-center gap-2 animate-in fade-in">
                      <Input 
                        value={tempPipeName} 
                        onChange={e => setTempPipeName(e.target.value)} 
                        className="h-9 w-64 font-bold text-lg bg-zinc-900"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleUpdatePipeName} className="h-9 w-9 text-green-500 hover:text-green-400 hover:bg-green-500/10"><Check size={18} /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsEditingPipeName(false)} className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"><X size={18} /></Button>
                  </div>
              ) : (
                  <div className="flex items-center gap-2">
                      <div className="relative group">
                          <select 
                            value={selectedPipelineId || ''}
                            onChange={(e) => setSelectedPipelineId(e.target.value)}
                            className="bg-transparent text-3xl font-bold text-white outline-none cursor-pointer hover:text-zinc-200 transition-colors appearance-none pr-8 z-10 relative"
                          >
                              {pipelines.map(p => (
                                  <option key={p.id} value={p.id} className="text-sm bg-zinc-900 text-zinc-200">
                                      {p.name}
                                  </option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-500 pointer-events-none" />
                      </div>
                      
                      {/* Botão de Edição FORA do Select Wrapper */}
                      {isManager && (
                          <Button size="icon" variant="ghost" onClick={startEditPipe} className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full" title="Renomear Funil">
                              <Edit2 size={14} />
                          </Button>
                      )}
                  </div>
              )}
          </div>
          
          <div className="flex items-center gap-3 mt-1">
              <span className="text-zinc-400 text-sm">Pipeline de Vendas</span>
              {isManager && (
                  <button onClick={() => setIsPipeModalOpen(true)} className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded border border-primary/20 transition-colors">
                      <GitMerge size={10} /> Criar Novo Funil
                  </button>
              )}
          </div>
        </div>

        <div className="flex items-center gap-3">
            {/* View Toggle (Só para Admins) */}
            {isManager && (
                <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button 
                        onClick={() => setViewMode('kanban')}
                        className={cn("p-2 rounded-md transition-all", viewMode === 'kanban' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                        title="Visualização Kanban"
                    >
                        <LayoutDashboard size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={cn("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                        title="Lista Geral (Todos)"
                    >
                        <List size={18} />
                    </button>
                </div>
            )}

            {/* Botão de Importar */}
            {isManager && (
                <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                    <Upload className="mr-2 h-4 w-4" /> Importar
                </Button>
            )}

            <Button onClick={() => setIsLeadModalOpen(true)} className="shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <Plus className="mr-2 h-4 w-4" /> Novo Lead
            </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
          {viewMode === 'list' && isManager ? (
              <LeadListView leads={allLeads} stages={stages} />
          ) : (
              <KanbanBoard />
          )}
      </div>

      <NewLeadModal 
        isOpen={isLeadModalOpen} 
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={refresh}
        defaultStageId={defaultStageId}
      />

      <NewPipelineModal
        isOpen={isPipeModalOpen}
        onClose={() => setIsPipeModalOpen(false)}
      />

      {/* Modal de Importação */}
      <ImportLeadsModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
