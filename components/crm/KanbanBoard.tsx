import React, { useState, useRef } from 'react';
import { Search, RefreshCw, Settings2, Plus, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import { LeadDetailsModal } from './LeadDetailsModal';
import { NewLeadModal } from './NewLeadModal';

export function KanbanBoard() {
  const { columns, loading, refresh, moveLead, initializeBoard } = useKanban();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  
  // Drag & Drop State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingFromCol, setDraggingFromCol] = useState<string | null>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll Drag Logic variables (refs to avoid re-renders)
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Filtering
  const getFilteredItems = (items: Lead[] = []) => {
      return items.filter(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.phone.includes(searchTerm)
      );
  };

  // DnD Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string, colId: string) => {
    setDraggingCardId(leadId);
    setDraggingFromCol(colId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    e.preventDefault();
    if (draggingCardId && draggingFromCol && draggingFromCol !== toColId) {
        moveLead(draggingCardId, draggingFromCol, toColId);
    }
    setDraggingCardId(null);
    setDraggingFromCol(null);
  };

  // Mouse Drag Scroll Handlers
  const onMouseDown = (e: React.MouseEvent) => {
     isDown.current = true;
     if(scrollContainerRef.current) {
         startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
         scrollLeft.current = scrollContainerRef.current.scrollLeft;
     }
  };
  
  const onMouseLeave = () => {
      isDown.current = false;
      setIsDraggingBoard(false);
  };
  
  const onMouseUp = () => {
      isDown.current = false;
      setTimeout(() => setIsDraggingBoard(false), 50);
  };
  
  const onMouseMove = (e: React.MouseEvent) => {
      if (!isDown.current) return;
      e.preventDefault();
      setIsDraggingBoard(true);
      if(scrollContainerRef.current) {
          const x = e.pageX - scrollContainerRef.current.offsetLeft;
          const walk = (x - startX.current) * 2; // Speed
          scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
      }
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
            <div className="w-full flex items-center justify-center text-zinc-500 h-full">
                <div className="text-center bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="mb-4">Nenhum estágio de funil configurado.</p>
                    <Button onClick={() => initializeBoard()} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                        Inicializar Funil Padrão
                    </Button>
                </div>
            </div>
        )}
      </div>

      <LeadDetailsModal 
        lead={selectedLead} 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />
      <NewLeadModal 
        isOpen={isNewLeadOpen} 
        onClose={() => setIsNewLeadOpen(false)} 
        onSuccess={refresh}
        defaultStageId={columns[0]?.id}
      />
    </div>
  );
}