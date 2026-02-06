
import React, { useEffect, useRef } from 'react';
import { Copy, Eraser, Trash, ArrowDown, ArrowRight, Table } from 'lucide-react';

interface SheetContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
}

export function SheetContextMenu({ x, y, onClose, onAction }: SheetContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div 
            ref={menuRef}
            className="fixed z-50 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 w-52 text-sm animate-in fade-in zoom-in-95"
            style={{ top: y, left: x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button onClick={() => onAction('copy')} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-zinc-500" /> Copiar
            </button>
            <button onClick={() => onAction('clear')} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2">
                <Eraser className="w-3.5 h-3.5 text-zinc-500" /> Limpar Conteúdo
            </button>
            <div className="h-px bg-zinc-200 my-1" />
            <button onClick={() => onAction('format_table')} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2 text-green-600">
                <Table className="w-3.5 h-3.5" /> Formatar como Tabela
            </button>
            <div className="h-px bg-zinc-200 my-1" />
            <button onClick={() => onAction('delete_row')} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2 text-red-600">
                <Trash className="w-3.5 h-3.5" /> Excluir Linha
            </button>
        </div>
    );
}
