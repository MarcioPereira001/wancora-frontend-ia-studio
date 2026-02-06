
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { CellData, SelectionRange } from './types';
import { DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_CELL_WIDTH, DEFAULT_CELL_HEIGHT, getColName, getCellId } from './utils';
import { Grid } from 'lucide-react';

interface SheetGridProps {
    cells: Record<string, CellData>;
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
    selections: SelectionRange[];
    activeCell: { r: number, c: number } | null;
    onMouseDown: (e: React.MouseEvent, r: number, c: number) => void;
    onMouseEnter: (r: number, c: number) => void;
    onResizeStart: (e: React.MouseEvent, type: 'col' | 'row', index: number) => void;
    onHeaderClick: (index: number, type: 'col' | 'row') => void;
    onFillHandleDown: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent, r: number, c: number) => void;
}

export const SheetGrid = ({
    cells, colWidths, rowHeights, selections, activeCell,
    onMouseDown, onMouseEnter, onResizeStart, onHeaderClick, onFillHandleDown, onContextMenu
}: SheetGridProps) => {
    
    // Helpers de Renderização
    const isSelected = (r: number, c: number) => {
        return selections.some(range => 
            r >= Math.min(range.start.r, range.end.r) &&
            r <= Math.max(range.start.r, range.end.r) &&
            c >= Math.min(range.start.c, range.end.c) &&
            c <= Math.max(range.start.c, range.end.c)
        );
    };

    const isHeadSelected = (index: number, type: 'col' | 'row') => {
        return selections.some(range => {
             if (type === 'col') {
                 return index >= Math.min(range.start.c, range.end.c) && index <= Math.max(range.start.c, range.end.c) && range.start.r === 0 && range.end.r === DEFAULT_ROWS - 1;
             } else {
                 return index >= Math.min(range.start.r, range.end.r) && index <= Math.max(range.start.r, range.end.r) && range.start.c === 0 && range.end.c === DEFAULT_COLS - 1;
             }
        });
    };

    return (
        <div className="relative bg-white" style={{ minWidth: '100%', width: 'max-content' }}>
            {/* 1. COLUMN HEADERS */}
            <div className="flex sticky top-0 z-20 shadow-sm">
                <div 
                    className="w-[40px] h-[24px] bg-zinc-100 border-r border-b border-zinc-300 shrink-0 sticky left-0 z-30 flex items-center justify-center cursor-pointer hover:bg-zinc-200"
                    onClick={() => onHeaderClick(-1, 'col')} // Select All
                >
                    <Grid className="w-3 h-3 text-zinc-400" />
                </div>
                {Array.from({ length: DEFAULT_COLS }).map((_, c) => (
                    <div 
                        key={c} 
                        className={cn(
                            "h-[24px] border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 relative group select-none transition-colors",
                            isHeadSelected(c, 'col') ? "bg-green-100 text-green-700 border-b-green-500" : "bg-zinc-100 hover:bg-zinc-200"
                        )}
                        style={{ width: colWidths[c] || DEFAULT_CELL_WIDTH }}
                        onClick={() => onHeaderClick(c, 'col')}
                    >
                        {getColName(c)}
                        <div 
                            className="absolute right-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-green-500 opacity-0 group-hover:opacity-100 z-10"
                            onMouseDown={(e) => onResizeStart(e, 'col', c)}
                        />
                    </div>
                ))}
            </div>

            {/* 2. ROWS & CELLS */}
            {Array.from({ length: DEFAULT_ROWS }).map((_, r) => (
                <div key={r} className="flex" style={{ height: rowHeights[r] || DEFAULT_CELL_HEIGHT }}>
                    {/* Row Index */}
                    <div 
                        className={cn(
                            "w-[40px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-600 sticky left-0 z-10 relative group select-none transition-colors cursor-pointer hover:bg-zinc-200",
                            isHeadSelected(r, 'row') ? "bg-green-100 text-green-700 border-r-green-500" : ""
                        )}
                        onClick={() => onHeaderClick(r, 'row')}
                    >
                        {r + 1}
                        <div 
                            className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize hover:bg-green-500 opacity-0 group-hover:opacity-100 z-10"
                            onMouseDown={(e) => onResizeStart(e, 'row', r)}
                        />
                    </div>

                    {/* Cells */}
                    {Array.from({ length: DEFAULT_COLS }).map((_, c) => {
                        const id = getCellId(r, c);
                        const cell = cells[id];
                        const selected = isSelected(r, c);
                        const active = activeCell?.r === r && activeCell?.c === c;
                        
                        return (
                            <div
                                key={id}
                                className={cn(
                                    "border-r border-b border-zinc-200 text-xs px-1 outline-none truncate relative cursor-cell",
                                    selected ? "bg-blue-50" : "bg-white",
                                    active && "ring-2 ring-green-600 z-10 bg-white",
                                    selected && !active && "border-blue-200"
                                )}
                                style={{ 
                                    width: colWidths[c] || DEFAULT_CELL_WIDTH,
                                    fontWeight: cell?.style?.bold ? 'bold' : 'normal',
                                    fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                                    textDecoration: cell?.style?.underline ? 'underline' : 'none',
                                    textAlign: cell?.style?.align || 'left',
                                    backgroundColor: selected && !cell?.style?.bg ? undefined : cell?.style?.bg,
                                    color: cell?.style?.color
                                }}
                                onMouseDown={(e) => onMouseDown(e, r, c)}
                                onMouseEnter={() => onMouseEnter(r, c)}
                                onContextMenu={(e) => onContextMenu(e, r, c)}
                            >
                                <div className="w-full h-full flex items-center overflow-hidden pointer-events-none">
                                    {/* Correção de render: prioriza computed, mas aceita value se computed for nulo. E trata 0 como string. */}
                                    {cell?.computed !== undefined && cell?.computed !== null ? cell.computed : (cell?.value ?? '')}
                                </div>
                                
                                {/* FILL HANDLE (O "quadradinho" mágico) */}
                                {active && selections.length > 0 && 
                                    r === Math.max(selections[selections.length-1].start.r, selections[selections.length-1].end.r) &&
                                    c === Math.max(selections[selections.length-1].start.c, selections[selections.length-1].end.c) && (
                                    <div 
                                        className="absolute bottom-[-4px] right-[-4px] w-2.5 h-2.5 bg-green-600 border border-white cursor-crosshair z-20 hover:scale-125 transition-transform" 
                                        onMouseDown={onFillHandleDown}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};
