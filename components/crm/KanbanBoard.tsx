import React, { useState, useRef } from 'react';
import { Search, RefreshCw, Plus, Filter, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { LeadDetailsModal } from './LeadDetailsModal';
import { NewLeadModal } from './NewLeadModal';

export function KanbanBoard() {
  const { columns, loading, refresh, moveLead } = useKanban();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  
  // Drag & Drop State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingFromCol, setDraggingFromCol] = useState<string | null>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll Drag Logic variables
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Filtering
  const getFilteredItems = (items: Lead[] = []) => {
      if (!searchTerm) return items;
      const lower = searchTerm.toLowerCase();
      return items.filter(item => 
          item.name.toLowerCase().includes(lower) || 
          item.phone.includes(lower) ||
          item.tags?.some(t => t.toLowerCase().includes(lower))
      );
  };

  // DnD Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string, colId: string) => {
    setDraggingCardId(leadId);
    setDraggingFromCol(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId); // Compatibilidade Firefox
    // Imagem fantasma transparente (opcional)
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    e.preventDefault();
    if (draggingCardId && draggingFromCol && draggingFromCol !== toColId) {
        moveLead(draggingCardId, toColId);
    }
    setDraggingCardId(null);
    setDraggingFromCol(null);
  };

  // Mouse Drag Scroll Handlers (Desktop touch-like experience)
  const onMouseDown = (e: React.MouseEvent) => {
     // Só ativa drag do board se clicar no background, não no card
     if ((e.target as HTMLElement).closest('.group')) return;
     
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
          const walk = (x - startX.current) * 1.5; // Velocidade do scroll
          scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
      }
  };

  if (loading && columns.length === 0) {
    return (
        <div className="flex flex-col h-full items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary w-10 h-10" />
            <p className="text-zinc-500 animate-pulse">Carregando Funil de Vendas...</p>
        </div>
    );
  }

  // Cálculo Total Geral do Pipeline
  const totalPipelineValue = columns.reduce((acc, col) => acc + col.totalValue, 0);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800">
        <div className="relative w-full md:w-auto flex items-center gap-4">
            <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar lead, telefone ou tag..." 
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-primary/50 text-sm h-10"
                />
            </div>
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded border border-zinc-800">
                <span className="text-xs text-zinc-500 font-bold uppercase">Total em Mesa:</span>
                <span className="text-sm font-mono text-green-400 font-bold">{formatCurrency(totalPipelineValue)}</span>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="ghost" size="icon" onClick={() => refresh()} title="Atualizar"><RefreshCw size={18} /></Button>
           <Button onClick={() => setIsNewLeadOpen(true)} className="flex-1 md:flex-none gap-2 font-bold shadow-[0_0_15px_rgba(34,197,94,0.2)]"><Plus size={18} /> Novo Lead</Button>
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
            className="min-w-[340px] w-[340px] flex flex-col h-full shrink-0 bg-zinc-900/20 rounded-xl border border-zinc-800/50 transition-colors hover:border-zinc-700/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-zinc-800/50 bg-zinc-900/50 rounded-t-xl backdrop-blur-sm group-hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] opacity-80" style={{ backgroundColor: col.color || '#52525b', color: col.color || '#52525b' }} />
                    <span className="font-bold text-zinc-100 text-sm tracking-tight">{col.title}</span>
                  </div>
                  <span className="bg-zinc-950 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-zinc-800">
                    {col.items ? getFilteredItems(col.items).length : 0}
                  </span>
              </div>
              
              {/* Totalizador da Coluna */}
              <div className="flex items-center gap-1 text-xs text-zinc-500 pl-6">
                  <DollarSign size={10} />
                  <span className="font-mono">{formatCurrency(col.totalValue)}</span>
              </div>
            </div>
            
            {/* Column Body */}
            <div className={cn(
                "flex-1 p-2 overflow-y-auto custom-scrollbar space-y-3 relative",
                draggingFromCol && draggingFromCol !== col.id ? "bg-zinc-950/20" : ""
            )}>
              {/* Highlight ao arrastar por cima */}
              {draggingFromCol && draggingFromCol !== col.id && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-zinc-700/50 rounded-b-xl z-0" />
              )}

              {col.items && getFilteredItems(col.items).map(lead => (
                <div key={lead.id} className={draggingCardId === lead.id ? "opacity-30 grayscale scale-95 transition-all" : "z-10 relative"}>
                    <KanbanCard 
                        lead={lead} 
                        onDragStart={(e) => handleDragStart(e, lead.id, col.id)}
                        onClick={(l) => { if(!isDraggingBoard) setSelectedLead(l); }}
                    />
                </div>
              ))}
              
              {col.items?.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800/30 rounded-xl m-1">
                      <p className="text-xs font-medium opacity-50">Arraste aqui</p>
                  </div>
              )}
            </div>
          </div>
        ))}

        {columns.length === 0 && (
            <div className="w-full flex items-center justify-center text-zinc-500 h-full">
                <div className="text-center bg-zinc-900/50 p-12 rounded-2xl border border-zinc-800 max-w-md">
                    <Filter className="w-16 h-16 mx-auto mb-6 opacity-20" />
                    <h3 className="text-xl font-bold text-white mb-2">Funil Vazio</h3>
                    <p className="mb-6 text-zinc-400">Parece que sua empresa ainda não configurou as etapas de venda.</p>
                    <Button onClick={() => refresh()} variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white">
                        <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
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