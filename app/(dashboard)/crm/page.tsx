'use client';

import React, { useState } from 'react';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { useKanban } from '@/hooks/useKanban';

export default function CRMPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { columns, refresh } = useKanban();

  // Encontra o ID da primeira coluna para usar como default
  const defaultStageId = columns.length > 0 ? columns[0].id : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Pipeline de Vendas</h1>
          <p className="text-zinc-400">Gerencie seus leads e oportunidades.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
        </Button>
      </div>

      <KanbanBoard />

      <NewLeadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={refresh}
        defaultStageId={defaultStageId}
      />
    </div>
  );
}