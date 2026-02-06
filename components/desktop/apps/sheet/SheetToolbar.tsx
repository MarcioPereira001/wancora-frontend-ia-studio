
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    PaintBucket, Type, Table as TableIcon, Eraser, Undo2, Redo2,
    DollarSign, Percent, Hash
} from 'lucide-react';
import { CellStyle } from './types';

interface SheetToolbarProps {
    onApplyFormat: (style: Partial<CellStyle>) => void;
    onFormatTable: () => void;
    onClear: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export function SheetToolbar({ onApplyFormat, onFormatTable, onClear, onUndo, onRedo, canUndo, canRedo }: SheetToolbarProps) {
    return (
        <div className="bg-zinc-100 border-b border-zinc-300 shrink-0 select-none">
            <div className="h-12 bg-white flex items-center px-4 gap-4 overflow-x-auto">
                 
                 {/* History Controls (Moved from Header) */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                     <Button size="icon" variant="ghost" onClick={onUndo} disabled={!canUndo} className="h-8 w-8 hover:bg-zinc-100" title="Desfazer (Ctrl+Z)">
                        <Undo2 className="w-4 h-4" />
                     </Button>
                     <Button size="icon" variant="ghost" onClick={onRedo} disabled={!canRedo} className="h-8 w-8 hover:bg-zinc-100" title="Refazer (Ctrl+Y)">
                        <Redo2 className="w-4 h-4" />
                     </Button>
                 </div>

                 {/* Text Formatting */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ bold: true })} className="h-8 w-8 hover:bg-zinc-100 font-bold" title="Negrito (Ctrl+B)"><Bold className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ italic: true })} className="h-8 w-8 hover:bg-zinc-100 italic" title="Itálico (Ctrl+I)"><Italic className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ underline: true })} className="h-8 w-8 hover:bg-zinc-100 underline" title="Sublinhado (Ctrl+U)"><Underline className="w-4 h-4" /></Button>
                 </div>

                 {/* Alignment */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ align: 'left' })} className="h-8 w-8" title="Esquerda"><AlignLeft className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ align: 'center' })} className="h-8 w-8" title="Centro"><AlignCenter className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ align: 'right' })} className="h-8 w-8" title="Direita"><AlignRight className="w-4 h-4" /></Button>
                 </div>

                 {/* Number Formatting */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ format: 'currency' })} className="h-8 w-8 hover:bg-zinc-100" title="Moeda (Ctrl+Shift+$)"><DollarSign className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ format: 'percent' })} className="h-8 w-8 hover:bg-zinc-100" title="Porcentagem (Ctrl+Shift+%)"><Percent className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onApplyFormat({ format: 'number' })} className="h-8 w-8 hover:bg-zinc-100" title="Número Simples"><Hash className="w-4 h-4" /></Button>
                 </div>

                 {/* Color */}
                 <div className="flex gap-2 items-center pr-4 border-r border-zinc-200">
                    <label className="cursor-pointer hover:bg-zinc-100 p-1.5 rounded flex flex-col items-center" title="Cor de Fundo">
                        <PaintBucket className="w-4 h-4 mb-0.5 text-zinc-600" />
                        <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => onApplyFormat({ bg: e.target.value })} />
                        <div className="w-4 h-1 bg-yellow-400 border border-zinc-200"></div>
                    </label>
                    <label className="cursor-pointer hover:bg-zinc-100 p-1.5 rounded flex flex-col items-center" title="Cor do Texto">
                        <Type className="w-4 h-4 mb-0.5 text-zinc-600" />
                        <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => onApplyFormat({ color: e.target.value })} />
                        <div className="w-4 h-1 bg-black border border-zinc-200"></div>
                    </label>
                 </div>

                 {/* Tools */}
                 <div className="flex gap-2 items-center">
                    <Button size="sm" variant="ghost" onClick={onFormatTable} className="text-xs gap-2 border border-dashed border-zinc-300 h-8">
                        <TableIcon className="w-4 h-4 text-green-600" /> Tabela
                    </Button>
                    <Button size="icon" variant="ghost" onClick={onClear} className="h-8 w-8 text-red-500 hover:bg-red-50" title="Limpar Tudo">
                        <Eraser className="w-4 h-4" />
                    </Button>
                 </div>
            </div>
        </div>
    );
}
