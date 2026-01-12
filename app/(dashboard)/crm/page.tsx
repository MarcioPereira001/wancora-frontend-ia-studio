'use client';

import React, { useState } from 'react';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Plus, GitMerge, Edit2, Check, X } from 'lucide-react';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { NewPipelineModal } from '@/components/crm/NewPipelineModal';
import { useKanban } from '@/hooks/useKanban';
import { Input } from '@/components/ui/input';

export default function CRMPage() {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isPipeModalOpen, setIsPipeModalOpen] = useState(false);
  const [isEditingPipeName, setIsEditingPipeName] = useState(false);
  const [tempPipeName, setTempPipeName] = useState('');
  
  const { pipelines, selectedPipelineId, setSelectedPipelineId, updatePipeline, columns, refresh } = useKanban();

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar com Seletor de Pipeline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
              {isEditingPipeName ? (
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2 group">
                      <select 
                        value={selectedPipelineId || ''}
                        onChange={(e) => setSelectedPipelineId(e.target.value)}
                        className="bg-transparent text-3xl font-bold text-white outline-none cursor-pointer hover:text-zinc-200 transition-colors appearance-none pr-4"
                      >
                          {pipelines.map(p => (
                              <option key={p.id} value={p.id} className="text-sm bg-zinc-900 text-zinc-200">
                                  {p.name}
                              </option>
                          ))}
                      </select>
                      <Button size="icon" variant="ghost" onClick={startEditPipe} className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-zinc-500 hover:text-white">
                          <Edit2 size={14} />
                      </Button>
                  </div>
              )}
          </div>
          <div className="flex items-center gap-2 mt-1">
              <span className="text-zinc-400 text-sm">Pipeline de Vendas</span>
              <button onClick={() => setIsPipeModalOpen(true)} className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded border border-primary/20 transition-colors">
                  <GitMerge size={10} /> Criar Novo Funil
              </button>
          </div>
        </div>

        <Button onClick={() => setIsLeadModalOpen(true)} className="shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
        </Button>
      </div>

      <KanbanBoard />

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
    </div>
  );
}