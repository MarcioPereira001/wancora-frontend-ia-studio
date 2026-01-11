'use client';

import React, { useState } from 'react';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead } from '@/types/crm';
import { Loader2, Filter, Search } from 'lucide-react';
import { LeadDetailsModal } from './LeadDetailsModal';
import { Input } from '@/components/ui/input';

export function KanbanBoard() {
  const { columns, loading, moveLead, refresh } = useKanban();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempFilter, setTempFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');

  const handleDragStart = (e: React.DragEvent, leadId: string, fromColId: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.setData('fromColId', fromColId);
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    const leadId = e.dataTransfer.getData('leadId');
    const fromColId = e.dataTransfer.getData('fromColId');
    
    if (fromColId && leadId && fromColId !== toColId) {
        moveLead(leadId, fromColId, toColId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const getFilteredItems = (items: Lead[]) => {
      if (!items) return [];
      return items.filter(item => {
          const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                item.phone.includes(searchTerm) || 
                                (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()));
          const matchesTemp = tempFilter === 'all' || item.temperature === tempFilter;
          return matchesSearch && matchesTemp;
      });
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
              <button onClick={() => setTempFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tempFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Todos</button>
              <button onClick={() => setTempFilter('hot')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tempFilter === 'hot' ? 'bg-red-900/40 text-red-200' : 'text-zinc-400 hover:text-red-400'}`}>Quentes</button>
              <button onClick={() => setTempFilter('warm')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tempFilter === 'warm' ? 'bg-orange-900/40 text-orange-200' : 'text-zinc-400 hover:text-orange-400'}`}>Mornos</button>
              <button onClick={() => setTempFilter('cold')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tempFilter === 'cold' ? 'bg-blue-900/40 text-blue-200' : 'text-zinc-400 hover:text-blue-400'}`}>Frios</button>
          </div>
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar leads..." 
                  className="pl-9 w-64 bg-zinc-900/50 border-zinc-800"
              />
          </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {columns.length > 0 ? columns.map((col) => (
          <div 
            key={col.id} 
            className="w-80 flex-shrink-0 flex flex-col bg-zinc-900/20 rounded-xl border border-zinc-800/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="p-3 flex items-center justify-between border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(var(--tw-shadow-color),0.5)]" style={{ backgroundColor: col.color || '#52525b' }} />
                <span className="font-semibold text-zinc-300 text-sm">{col.title}</span>
              </div>
              <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                {col.items ? getFilteredItems(col.items).length : 0}
              </span>
            </div>
            
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
              {col.items && getFilteredItems(col.items).map(lead => (
                <KanbanCard 
                    key={lead.id} 
                    lead={lead} 
                    onDragStart={(e) => handleDragStart(e, lead.id, col.id)}
                    onClick={() => setSelectedLead(lead)}
                />
              ))}
            </div>
          </div>
        )) : (
            <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
                <Filter className="w-10 h-10 mb-2 opacity-50" />
                <p>Nenhum estágio de funil configurado.</p>
            </div>
        )}
      </div>

      {selectedLead && (
        <LeadDetailsModal 
            lead={selectedLead} 
            isOpen={!!selectedLead} 
            onClose={() => { setSelectedLead(null); refresh(); }} 
        />
      )}
    </div>
  );
}