
import React, { useState, useRef, useMemo } from 'react';
import { Search, RefreshCw, Filter, Loader2, DollarSign, GripVertical, Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead, KanbanColumn } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { LeadDetailsModal } from './LeadDetailsModal';
import { NewLeadModal } from './NewLeadModal';
import { EditStageModal } from './EditStageModal';
import { useTeam } from '@/hooks/useTeam';
import { useSound } from '@/hooks/useSound';

export function KanbanBoard() {
  const { columns, loading, refresh, moveLead, reorderStages } = useKanban();
  const { members } = useTeam();
  const { play } = useSound(); // Hook de som
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingStage, setEditingStage] = useState<KanbanColumn | null>(null);

  const [draggingType, setDraggingType] = useState<'CARD' | 'COLUMN' | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingFromCol, setDraggingFromCol] = useState<string | null>(null); 
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Filtering Optimization: Memoize to avoid recalc on every render
  const filteredColumns = useMemo(() => {
      return columns.map(col => ({
          ...col,
          items: col.items.filter(item => {
              // SAFE SEARCH: Garante que name nunca seja null antes do toLowerCase
              const itemName = (item.name || '').toLowerCase();
              const itemPhone = (item.phone || '').toLowerCase();
              const searchLower = searchTerm.toLowerCase();

              const matchesSearch = !searchTerm || 
                  itemName.includes(searchLower) || 
                  itemPhone.includes(searchLower) ||
                  item.tags?.some(t => t.toLowerCase().includes(searchLower));
              
              const matchesUser = selectedUserId === 'all' || item.owner_id === selectedUserId;
              
              return matchesSearch && matchesUser;
          })
      }));
  }, [columns, searchTerm, selectedUserId]);

  // --- DND HANDLERS ---

  const handleDragStart = (e: React.DragEvent, type: 'CARD' | 'COLUMN', id: string, colId?: string) => {
    e.stopPropagation(); 
    setDraggingType(type);
    setDraggingId(id);
    if (type === 'CARD' && colId) setDraggingFromCol(colId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent, targetId: string, type: 'CARD' | 'COLUMN') => {
    e.preventDefault();
    e.stopPropagation();

    // CARD DROP - LÓGICA SMART (Posicionamento Matemático)
    if (draggingType === 'CARD' && type === 'COLUMN') {
        const column = filteredColumns.find(c => c.id === targetId);
        if (!column) return;

        // 1. Identificar cards na coluna alvo
        const cardsInColumn = column.items;
        
        // 2. Calcular onde soltou (baseado no Y do mouse)
        // Precisamos encontrar o card que está LOGO ABAIXO do mouse
        const dropY = e.clientY;
        
        // Itera sobre os elementos visuais da coluna (usando o DOM, pois a geometria importa)
        if (draggingId) {
            let newPosition = 0;
            
            // Re-analisa posição exata para inserção precisa
            // Se não temos elementos visuais suficientes para calcular, usamos a lógica de lista
            const elements = Array.from(document.querySelectorAll(`[data-column-id="${targetId}"] .kanban-card-wrapper`));
            let indexToInsert = elements.length; // Default: final

            for (let i = 0; i < elements.length; i++) {
                const rect = elements[i].getBoundingClientRect();
                const middleY = rect.top + rect.height / 2;
                if (e.clientY < middleY) {
                    indexToInsert = i;
                    break;
                }
            }

            // Cards visuais nesta ordem
            const targetCards = [...cardsInColumn];
            const existingIdx = targetCards.findIndex(c => c.id === draggingId);
            if (existingIdx !== -1) targetCards.splice(existingIdx, 1);

            if (targetCards.length === 0) {
                // Coluna vazia: Usa Date.now() + Random para evitar colisão absoluta em drops rápidos
                newPosition = Date.now() + Math.random();
            } else if (indexToInsert === 0) {
                // Topo
                newPosition = (targetCards[0].position || 0) - 1000;
            } else if (indexToInsert >= targetCards.length) {
                // Fundo
                newPosition = (targetCards[targetCards.length - 1].position || 0) + 1000;
            } else {
                // Meio (Média aritmética)
                const posAbove = targetCards[indexToInsert - 1]?.position || 0;
                const posBelow = targetCards[indexToInsert]?.position || 0;
                newPosition = (posAbove + posBelow) / 2;
            }

            // Move e toca som
            moveLead(draggingId, targetId, newPosition);
            play('success'); // Toca som de sucesso
        }
    }

    // COLUMN DROP (Reorder)
    if (draggingType === 'COLUMN' && type === 'COLUMN') {
        if (draggingId && draggingId !== targetId) {
            const oldIndex = columns.findIndex(c => c.id === draggingId);
            const newIndex = columns.findIndex(c => c.id === targetId);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = [...columns];
                const [moved] = newOrder.splice(oldIndex, 1);
                newOrder.splice(newIndex, 0, moved);
                const payload = newOrder.map((col, idx) => ({ id: col.id, position: idx }));
                reorderStages(payload);
            }
        }
    }

    setDraggingType(null);
    setDraggingId(null);
    setDraggingFromCol(null);
  };

  // --- SCROLL PAN HANDLERS ---
  const onMouseDown = (e: React.MouseEvent) => {
     if ((e.target as HTMLElement).closest('.interactive') || draggingType) return;
     e.preventDefault(); 
     isDown.current = true;
     if(scrollContainerRef.current) {
         scrollContainerRef.current.classList.add('cursor-grabbing');
         startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
         scrollLeft.current = scrollContainerRef.current.scrollLeft;
     }
  };
  
  const onMouseLeave = () => {
      isDown.current = false;
      scrollContainerRef.current?.classList.remove('cursor-grabbing');
  };
  
  const onMouseUp = () => {
      isDown.current = false;
      scrollContainerRef.current?.classList.remove('cursor-grabbing');
  };
  
  const onMouseMove = (e: React.MouseEvent) => {
      if (!isDown.current) return;
      e.preventDefault();
      if(scrollContainerRef.current) {
          const x = e.pageX - scrollContainerRef.current.offsetLeft;
          const walk = (x - startX.current) * 1.5; 
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

  const totalPipelineValue = columns.reduce((acc, col) => acc + col.totalValue, 0);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500 select-none">
      
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-1 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800 interactive">
        <div className="relative w-full md:w-auto flex items-center gap-4 flex-1">
            <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar lead..." 
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-primary/50 text-sm h-10"
                />
            </div>
            
            <div className="relative hidden md:block">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <select 
                    className="h-10 pl-9 pr-8 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-300 outline-none focus:border-primary/50 appearance-none cursor-pointer hover:bg-zinc-900 transition-colors"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                >
                    <option value="all">Todos os Responsáveis</option>
                    {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded border border-zinc-800 ml-auto">
                <span className="text-xs text-zinc-500 font-bold uppercase">Total:</span>
                <span className="text-sm font-mono text-green-400 font-bold">{formatCurrency(totalPipelineValue)}</span>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="ghost" size="icon" onClick={() => refresh()} title="Atualizar"><RefreshCw size={18} /></Button>
        </div>
      </div>

      {/* Board Container */}
      <div 
        ref={scrollContainerRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        className="flex-1 flex gap-4 overflow-x-auto pb-4 px-1 cursor-grab active:cursor-grabbing custom-scrollbar"
        style={{ scrollBehavior: 'auto' }} 
      >
        {filteredColumns.map((col) => {
          // Itens já estão filtrados pelo useMemo
          const items = col.items;
          
          return (
            <div 
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id, 'COLUMN')}
                className={cn(
                    "min-w-[340px] w-[340px] flex flex-col h-full shrink-0 bg-zinc-900/20 rounded-xl border transition-all duration-200",
                    draggingType === 'COLUMN' && draggingId === col.id ? "opacity-50 border-dashed border-primary" : "border-zinc-800/50 hover:border-zinc-700/50"
                )}
            >
                {/* Column Header */}
                <div 
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'COLUMN', col.id)}
                    className="p-3 border-b border-zinc-800/50 bg-zinc-900/50 rounded-t-xl backdrop-blur-sm group/header relative hover:bg-zinc-900/80 transition-colors cursor-move interactive"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="text-zinc-600 hover:text-zinc-300 transition-colors">
                                <GripVertical size={14} />
                            </div>
                            <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] opacity-80 shrink-0" style={{ backgroundColor: col.color || '#52525b', color: col.color || '#52525b' }} />
                            <span className="font-bold text-zinc-100 text-sm tracking-tight truncate">{col.title}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="bg-zinc-950 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-zinc-800">
                                {items.length}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingStage(col); }}
                                className="p-1 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover/header:opacity-100 transition-opacity interactive"
                            >
                                <Settings2 size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-zinc-500 pl-8">
                        <DollarSign size={10} />
                        <span className="font-mono">{formatCurrency(col.totalValue)}</span>
                    </div>
                </div>
                
                {/* Column Body */}
                <div 
                    className={cn(
                        "flex-1 p-2 overflow-y-auto custom-scrollbar space-y-3 relative interactive",
                        draggingType === 'CARD' && draggingFromCol && draggingFromCol !== col.id ? "bg-primary/5" : ""
                    )}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id, 'COLUMN')} 
                    data-column-id={col.id} 
                >
                {/* Placeholder para Drop */}
                {draggingType === 'CARD' && draggingFromCol && draggingFromCol !== col.id && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/20 rounded-b-xl z-0" />
                )}

                {items.map(lead => (
                    <div 
                        key={lead.id} 
                        id={`card-${lead.id}`} 
                        className={cn("kanban-card-wrapper transition-all duration-200", draggingId === lead.id ? "opacity-30 grayscale scale-95" : "z-10 relative")}
                    >
                        <KanbanCard 
                            lead={lead} 
                            owner={members.find(m => m.id === lead.owner_id)}
                            onDragStart={(e) => handleDragStart(e, 'CARD', lead.id, col.id)}
                            onClick={(l) => { if(!isDown.current) setSelectedLead(l); }}
                        />
                    </div>
                ))}
                
                {items.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800/30 rounded-xl m-1">
                        <p className="text-xs font-medium opacity-50">Solte aqui</p>
                    </div>
                )}
                </div>
            </div>
          );
        })}
      </div>

      <LeadDetailsModal 
        lead={selectedLead} 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />
      <EditStageModal
        stage={editingStage}
        isOpen={!!editingStage}
        onClose={() => setEditingStage(null)}
      />
    </div>
  );
}
