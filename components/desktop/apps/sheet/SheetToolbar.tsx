
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    PaintBucket, Type, Table as TableIcon, Eraser, FileDown, Upload, Save, 
    ChevronDown, DollarSign, Percent, Hash, Cloud
} from 'lucide-react';
import { CellStyle } from './types';
import { cn } from '@/lib/utils';

interface SheetToolbarProps {
    onApplyFormat: (style: Partial<CellStyle>) => void;
    onFormatTable: () => void;
    onClear: () => void;
    onOpenSaveModal: () => void; // Mudança: Agora abre o modal
    onExport: (type: 'xlsx' | 'csv' | 'pdf') => void;
    onImportDrive: () => void;
    onImportLocal: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SheetToolbar({ onApplyFormat, onFormatTable, onClear, onOpenSaveModal, onExport, onImportDrive, onImportLocal }: SheetToolbarProps) {
    const [showFileMenu, setShowFileMenu] = useState(false);
    const [showImportMenu, setShowImportMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const importRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowFileMenu(false);
            }
            if (importRef.current && !importRef.current.contains(e.target as Node)) {
                setShowImportMenu(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className="bg-zinc-100 border-b border-zinc-300 shrink-0 select-none">
            <div className="h-12 bg-white flex items-center px-4 gap-4 overflow-x-auto">
                 
                 {/* SAVE BUTTON */}
                 <div className="pr-4 border-r border-zinc-200">
                     <Button 
                        size="sm" 
                        onClick={onOpenSaveModal} 
                        className="bg-green-600 hover:bg-green-500 text-white gap-2 h-8 text-xs font-bold"
                    >
                        <Save className="w-3.5 h-3.5" /> Salvar / Baixar
                     </Button>
                 </div>

                 {/* IMPORT MENU */}
                 <div className="relative pr-4 border-r border-zinc-200" ref={importRef}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn("h-8 gap-1 font-bold text-zinc-600", showImportMenu ? "bg-zinc-100" : "")}
                        onClick={() => setShowImportMenu(!showImportMenu)}
                    >
                        <Upload className="w-3.5 h-3.5 text-orange-500" /> Importar <ChevronDown className="w-3 h-3" />
                    </Button>
                    
                    {showImportMenu && (
                        <div className="absolute top-10 left-0 bg-white border border-zinc-200 shadow-xl rounded-lg w-48 py-1 z-50 animate-in fade-in zoom-in-95">
                            <button onClick={() => { onImportDrive(); setShowImportMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2">
                                <Cloud className="w-4 h-4 text-blue-500" /> Do Google Drive
                            </button>
                            <label className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2 cursor-pointer">
                                <Upload className="w-4 h-4 text-zinc-500" /> Do Computador
                                <input type="file" className="hidden" accept=".xlsx" onChange={(e) => { onImportLocal(e); setShowImportMenu(false); }} />
                            </label>
                        </div>
                    )}
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
