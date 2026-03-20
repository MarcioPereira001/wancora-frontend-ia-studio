import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, RefreshCw, Loader2, DollarSign, GripVertical, Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKanban } from '@/hooks/useKanban';
import { KanbanCard } from './KanbanCard';
import { Lead, KanbanColumn } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { LeadDetailsModal } from './LeadDetailsModal';
import { EditStageModal } from './EditStageModal';
import { useTeam } from '@/hooks/useTeam';
import { useSound } from '@/hooks/useSound';

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- SORTABLE CARD COMPONENT ---
function SortableCard({ lead, owner, onClick }: { lead: Lead, owner: any, onClick: any }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'CARD', lead },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <KanbanCard 
      lead={lead} 
      owner={owner} 
      onClick={onClick}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      style={style}
      isDragging={isDragging}
    />
  );
}

// --- SORTABLE COLUMN COMPONENT ---
function SortableColumn({ col, items, members, onEdit, onClickCard }: any) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: col.id,
    data: { type: 'COLUMN', col },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-w-[340px] w-[340px] flex flex-col h-full shrink-0 bg-zinc-900/20 rounded-xl border transition-colors duration-200",
        isDragging ? "border-dashed border-primary" : "border-zinc-800/50 hover:border-zinc-700/50"
      )}
    >
      {/* Column Header */}
      <div 
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="p-3 border-b border-zinc-800/50 bg-zinc-900/50 rounded-t-xl backdrop-blur-sm group/header relative hover:bg-zinc-900/80 transition-colors cursor-grab active:cursor-grabbing interactive"
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
                    onClick={(e) => { e.stopPropagation(); onEdit(col); }}
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
      <div className="flex-1 p-2 overflow-y-auto custom-scrollbar space-y-3 relative interactive">
        <SortableContext items={items.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((lead: any) => (
            <SortableCard 
              key={lead.id}
              lead={lead}
              owner={members.find((m: any) => m.id === lead.owner_id)}
              onClick={onClickCard}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800/30 rounded-xl m-1">
                <p className="text-xs font-medium opacity-50">Solte aqui</p>
            </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { columns, loading, refresh, moveLead, reorderStages } = useKanban();
  const { members } = useTeam();
  const { play } = useSound();
  
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>([]);
  
  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingStage, setEditingStage] = useState<KanbanColumn | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'COLUMN' | 'CARD' | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const filteredColumns = useMemo(() => {
      return localColumns.map(col => ({
          ...col,
          items: col.items.filter(item => {
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
  }, [localColumns, searchTerm, selectedUserId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveType(active.data.current?.type);
    setActiveData(active.data.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveCard = active.data.current?.type === 'CARD';
    const isOverColumn = over.data.current?.type === 'COLUMN';

    if (!isActiveCard) return;

    setLocalColumns((prev) => {
      const activeColumn = prev.find(c => c.items.some(i => i.id === activeId));
      const overColumn = isOverColumn 
        ? prev.find(c => c.id === overId)
        : prev.find(c => c.items.some(i => i.id === overId));

      if (!activeColumn || !overColumn) return prev;

      if (activeColumn.id !== overColumn.id) {
        const activeItems = [...activeColumn.items];
        const overItems = [...overColumn.items];
        
        const activeIndex = activeItems.findIndex(i => i.id === activeId);
        const overIndex = isOverColumn 
          ? overItems.length 
          : overItems.findIndex(i => i.id === overId);

        const [item] = activeItems.splice(activeIndex, 1);
        const updatedItem = { ...item, pipeline_stage_id: overColumn.id };
        
        overItems.splice(overIndex, 0, updatedItem);

        return prev.map(c => {
          if (c.id === activeColumn.id) return { ...c, items: activeItems };
          if (c.id === overColumn.id) return { ...c, items: overItems };
          return c;
        });
      }

      return prev;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    setActiveData(null);

    if (!over) {
      setLocalColumns(columns);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const isActiveColumn = active.data.current?.type === 'COLUMN';
    if (isActiveColumn) {
      if (activeId !== overId) {
        const oldIndex = localColumns.findIndex(c => c.id === activeId);
        const newIndex = localColumns.findIndex(c => c.id === overId);
        const newOrder = arrayMove(localColumns, oldIndex, newIndex);
        setLocalColumns(newOrder);
        
        const payload = newOrder.map((col, idx) => ({ id: col.id, position: idx }));
        reorderStages(payload);
      }
      return;
    }

    // It's a CARD
    const activeColumn = localColumns.find(c => c.items.some(i => i.id === activeId));
    const overColumn = over.data.current?.type === 'COLUMN' 
      ? localColumns.find(c => c.id === overId)
      : localColumns.find(c => c.items.some(i => i.id === overId));

    if (!activeColumn || !overColumn) {
      setLocalColumns(columns);
      return;
    }

    const activeIndex = activeColumn.items.findIndex(i => i.id === activeId);
    const overIndex = over.data.current?.type === 'COLUMN'
      ? overColumn.items.length
      : overColumn.items.findIndex(i => i.id === overId);

    if (activeColumn.id === overColumn.id) {
      if (activeIndex !== overIndex) {
        const newItems = arrayMove(activeColumn.items, activeIndex, overIndex);
        setLocalColumns(prev => prev.map(c => c.id === activeColumn.id ? { ...c, items: newItems } : c));
        
        const newPos = calculateNewPosition(newItems, overIndex);
        moveLead(activeId, overColumn.id, newPos);
        play('success');
      }
    } else {
      const newItems = [...overColumn.items];
      const currentItemIndex = newItems.findIndex(i => i.id === activeId);
      if (currentItemIndex !== -1 && currentItemIndex !== overIndex) {
          const finalItems = arrayMove(newItems, currentItemIndex, overIndex);
          setLocalColumns(prev => prev.map(c => c.id === overColumn.id ? { ...c, items: finalItems } : c));
          const newPos = calculateNewPosition(finalItems, overIndex);
          moveLead(activeId, overColumn.id, newPos);
      } else {
          const newPos = calculateNewPosition(newItems, currentItemIndex !== -1 ? currentItemIndex : overIndex);
          moveLead(activeId, overColumn.id, newPos);
      }
      play('success');
    }
  };

  function calculateNewPosition(items: any[], index: number) {
    if (items.length <= 1) return Date.now() + Math.random();
    if (index === 0) return (items[1]?.position || 0) - 1000;
    if (index === items.length - 1) return (items[items.length - 2]?.position || 0) + 1000;
    
    const posAbove = items[index - 1]?.position || 0;
    const posBelow = items[index + 1]?.position || 0;
    return (posAbove + posBelow) / 2;
  }

  // --- SCROLL PAN HANDLERS ---
  const onMouseDown = (e: React.MouseEvent) => {
     if ((e.target as HTMLElement).closest('.interactive') || activeId) return;
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

  const totalPipelineValue = localColumns.reduce((acc, col) => acc + col.totalValue, 0);

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div 
          ref={scrollContainerRef}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
          className="flex-1 flex gap-4 overflow-x-auto pb-4 px-1 cursor-grab active:cursor-grabbing custom-scrollbar"
          style={{ scrollBehavior: 'auto' }} 
        >
          <SortableContext items={filteredColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {filteredColumns.map((col) => (
              <SortableColumn 
                key={col.id}
                col={col}
                items={col.items}
                members={members}
                onEdit={setEditingStage}
                onClickCard={(l: Lead) => { if(!isDown.current) setSelectedLead(l); }}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay dropAnimation={defaultDropAnimationSideEffects({ duration: 200 })}>
          {activeId && activeType === 'CARD' && activeData?.lead ? (
            <KanbanCard 
              lead={activeData.lead} 
              owner={members.find(m => m.id === activeData.lead.owner_id)}
              onClick={() => {}}
              isDragging
            />
          ) : null}
          {activeId && activeType === 'COLUMN' && activeData?.col ? (
            <SortableColumn 
              col={activeData.col}
              items={activeData.col.items}
              members={members}
              onEdit={() => {}}
              onClickCard={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
