'use client';

import React, { useState, useRef } from 'react';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead } from '@/types';
import { Loader2, Plus, Settings2, RefreshCw, Filter, Search } from 'lucide-react';
import { LeadDetailsModal } from './LeadDetailsModal';
import { NewLeadModal } from './NewLeadModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function KanbanBoard() {
  const { columns, loading, moveLead, refresh } = useKanban();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Drag to Scroll Logic
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Native DnD State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingFromCol, setDraggingFromCol] = useState<string | null>(null);

  // --- Scroll Logic ---
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.cursor-grab')) return; // Ignore clicks on cards
    if (!scrollContainerRef.current) return;
    setIsDraggingBoard(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDraggingBoard(false);
  const onMouseUp = () => setIsDraggingBoard(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // --- DnD Logic ---
  const handleDragStart = (e: React.DragEvent, leadId: string, colId: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.setData('fromColId', colId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingCardId(leadId);
    setDraggingFromCol(colId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const fromColId = e.dataTransfer.getData('fromColId');
    
    if (leadId && fromColId && fromColId !== toColId) {
        moveLead(leadId, fromColId, toColId);
    }
    setDraggingCardId(null);
    setDraggingFromCol(null);
  };

  // Filtering
  const getFilteredItems = (items: Lead[] = []) => {
      return items.filter(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.phone.includes(searchTerm)
      );
  };

  if (loading && columns.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>;
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1">
        <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou telefone..." 
                className="pl-9 w-full md:w-80 bg-zinc-900/50 border-zinc-800 focus:border-primary/50"
            />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="ghost" size="icon" onClick={() => refresh()} title="Atualizar"><RefreshCw size={18} /></Button>
           <Button variant="outline" className="hidden md:flex gap-2 bg-zinc-900 border-zinc-800"><Settings2 size={16} /> Configurar</Button>
           <Button onClick={() => setIsNewLeadOpen(true)} className="flex-1 md:flex-none gap-2 font-bold"><Plus size={18} /> Novo Lead</Button>
        </div>
      </div>

      {/* Board */}
      <div 
        ref={scrollContainerRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        className="flex-1 flex gap-4 overflow-x-auto pb-4 px-1 cursor-grab active:cursor-grabbing select-none"
      >
        {columns.map((col) => (
          <div 
            key={col.id} 
            className="min-w-[320px] w-[320px] flex flex-col h-full shrink-0 bg-zinc-900/20 rounded-xl border border-zinc-800/50 transition-colors hover:border-zinc-700/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="p-3 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900/30 rounded-t-xl backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] opacity-80" style={{ backgroundColor: col.color || '#52525b', color: col.color || '#52525b' }} />
                <span className="font-semibold text-zinc-200 text-sm tracking-tight">{col.title}</span>
                <span className="bg-zinc-800 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-zinc-700">
                  {col.items ? getFilteredItems(col.items).length : 0}
                </span>
              </div>
              <button 
                onClick={() => setIsNewLeadOpen(true)}
                className="text-zinc-600 hover:text-white transition-colors p-1.5 hover:bg-zinc-800 rounded-md"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {/* Column Body */}
            <div className={cn(
                "flex-1 p-2 overflow-y-auto custom-scrollbar space-y-3",
                draggingFromCol && draggingFromCol !== col.id ? "bg-zinc-950/20" : ""
            )}>
              {col.items && getFilteredItems(col.items).map(lead => (
                <div key={lead.id} className={draggingCardId === lead.id ? "opacity-50 grayscale" : ""}>
                    <KanbanCard 
                        lead={lead} 
                        onDragStart={(e) => handleDragStart(e, lead.id, col.id)}
                        onClick={(l) => { if(!isDraggingBoard) setSelectedLead(l); }}
                    />
                </div>
              ))}
              {col.items?.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800/50 rounded-xl m-1">
                      <p className="text-xs">Solte aqui</p>
                  </div>
              )}
            </div>
          </div>
        ))}
        {columns.length === 0 && (
            <div className="w-full flex items-center justify-center text-zinc-500">
                <div className="text-center">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum estágio configurado.</p>
                </div>
            </div>
        )}
      </div>

      {/* FIXED: Conditionally render the modal only if selectedLead exists */}
      {selectedLead && (
        <LeadDetailsModal 
          lead={selectedLead} 
          isOpen={!!selectedLead} 
          onClose={() => { setSelectedLead(null); refresh(); }} 
        />
      )}

      <NewLeadModal 
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
        onSuccess={() => refresh()}
        defaultStageId={columns[0]?.id}
      />
    </div>
  );
}