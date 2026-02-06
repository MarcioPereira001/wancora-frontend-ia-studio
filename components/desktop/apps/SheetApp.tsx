
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Save, FileSpreadsheet, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    Undo2, Redo2, Plus, Trash, Loader2, Grid, 
    PaintBucket, Type, Copy, Clipboard, Eraser, Table as TableIcon, 
    Scissors, MousePointerClick, MoreVertical
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import ExcelJS from 'exceljs';

// --- CONSTANTES & CONFIG ---
const DEFAULT_COLS = 26; // A-Z
const DEFAULT_ROWS = 100;
const DEFAULT_CELL_WIDTH = 100;
const DEFAULT_CELL_HEIGHT = 24;

// --- TIPAGEM ---
interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    bg?: string;
    color?: string;
    fontSize?: number;
    border?: string; // 'top' | 'bottom' | 'left' | 'right' | 'all'
}

interface CellData {
    value: string; 
    computed?: string | number | null;
    style?: CellStyle;
}

interface SelectionRange {
    start: { r: number, c: number };
    end: { r: number, c: number };
}

interface ContextMenuState {
    x: number;
    y: number;
    target: { r: number, c: number } | 'selection';
}

// --- HELPER FUNCTIONS ---
const getColName = (index: number) => {
    let columnName = "";
    let i = index;
    while (i >= 0) {
        columnName = String.fromCharCode((i % 26) + 65) + columnName;
        i = Math.floor(i / 26) - 1;
    }
    return columnName;
};

const getCellId = (r: number, c: number) => `${getColName(c)}${r + 1}`;

const parseCellId = (id: string) => {
    const match = id.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { r: parseInt(rowStr) - 1, c: col - 1 };
};

// --- MOTOR DE FÓRMULAS V2 ---
const evaluateFormula = (expression: string, cells: Record<string, CellData>): string | number => {
    // Se estiver vazio, retorna string vazia (Correção do bug do "0")
    if (expression === '' || expression === null || expression === undefined) return '';
    
    // Se for número, retorna número
    if (!isNaN(Number(expression))) return Number(expression);

    if (!expression.startsWith('=')) return expression;

    let cleanExpr = expression.substring(1).toUpperCase().trim();

    try {
        // 1. Resolve Intervalos (ex: A1:A3 -> [A1, A2, A3])
        cleanExpr = cleanExpr.replace(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/g, (match, startId, endId) => {
            const start = parseCellId(startId);
            const end = parseCellId(endId);
            if (!start || !end) return "0";

            const values = [];
            const minR = Math.min(start.r, end.r);
            const maxR = Math.max(start.r, end.r);
            const minC = Math.min(start.c, end.c);
            const maxC = Math.max(start.c, end.c);

            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    const id = getCellId(r, c);
                    const cellVal = cells[id]?.value;
                    // Trata valor vazio como 0 apenas dentro de operações matemáticas de range
                    const val = (cellVal === '' || cellVal === undefined) ? 0 : (cells[id]?.computed || cellVal);
                    values.push(Number(val) || 0);
                }
            }
            return `[${values.join(',')}]`;
        });

        // 2. Resolve Referências Únicas (ex: A1)
        cleanExpr = cleanExpr.replace(/[A-Z]+[0-9]+/g, (match) => {
            const cell = cells[match];
            if (!cell) return "0";
            const val = cell.computed !== undefined ? cell.computed : cell.value;
            // Se for string não numérica, envolve em aspas para o eval
            return isNaN(Number(val)) ? `"${val}"` : String(val || 0);
        });

        // 3. Funções Avançadas
        // SUM, AVG, MIN, MAX, COUNT
        if (cleanExpr.includes('SUM(')) {
            cleanExpr = cleanExpr.replace(/SUM\((.*?)\)/g, (_, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return String(nums.reduce((a: number, b: number) => a + b, 0));
            });
        }
        if (cleanExpr.includes('AVG(') || cleanExpr.includes('MEDIA(')) {
            cleanExpr = cleanExpr.replace(/(AVG|MEDIA)\((.*?)\)/g, (_, __, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return nums.length ? String(nums.reduce((a: number, b: number) => a + b, 0) / nums.length) : "0";
            });
        }
        if (cleanExpr.includes('MIN(')) {
            cleanExpr = cleanExpr.replace(/MIN\((.*?)\)/g, (_, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return String(Math.min(...nums));
            });
        }
        if (cleanExpr.includes('MAX(')) {
            cleanExpr = cleanExpr.replace(/MAX\((.*?)\)/g, (_, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return String(Math.max(...nums));
            });
        }

        // Logic: IF(cond, true, false)
        cleanExpr = cleanExpr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");
        
        // Text: CONCAT, TRIM
        cleanExpr = cleanExpr.replace(/CONCAT\((.*?)\)/g, "($1)"); // JS Concat via +
        
        // 4. Eval Final Seguro
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${cleanExpr}`)();
        return isNaN(result) && typeof result !== 'string' ? '#VALOR!' : result;

    } catch (e) {
        return "#ERR";
    }
};

export function SheetApp({ windowId }: { windowId: string }) {
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  // --- STATE ---
  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Nova Planilha'));
  const [cells, setCells] = useState<Record<string, CellData>>(initialState.cells || {});
  
  const [colWidths, setColWidths] = useState<Record<number, number>>(initialState.colWidths || {});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(initialState.rowHeights || {});

  // Selection
  const [activeCell, setActiveCell] = useState<{r: number, c: number} | null>(null);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'fill'>('select'); // Novo: Fill Handle
  
  // UI & Menu
  const [activeTab, setActiveTab] = useState<'home' | 'data' | 'view'>('home');
  const [formulaInput, setFormulaInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ type: 'col'|'row', index: number, start: number, startSize: number } | null>(null);

  // --- HISTORY ---
  const [history, setHistory] = useState<{cells: Record<string, CellData>}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = () => {
      const snapshot = JSON.parse(JSON.stringify(cells));
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ cells: snapshot });
      if(newHistory.length > 30) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setWindowDirty(windowId, true);
  };

  const undo = () => {
      if(historyIndex > 0) {
          setCells(history[historyIndex - 1].cells);
          setHistoryIndex(historyIndex - 1);
      }
  };

  const redo = () => {
      if(historyIndex < history.length - 1) {
          setCells(history[historyIndex + 1].cells);
          setHistoryIndex(historyIndex + 1);
      }
  };

  // --- RECALCULATION ---
  const recalculateAll = (currentCells: Record<string, CellData>) => {
      const nextCells = { ...currentCells };
      Object.keys(nextCells).forEach(key => {
          const cell = nextCells[key];
          if(cell.value && cell.value.toString().startsWith('=')) {
              cell.computed = evaluateFormula(cell.value, nextCells);
          } else {
              // Tenta converter pra número se possível, senão mantém string
              const num = Number(cell.value);
              // Correção BUG DO 0: Se for string vazia, não converte pra 0
              if (cell.value === '') cell.computed = '';
              else cell.computed = isNaN(num) ? cell.value : num;
          }
      });
      return nextCells;
  };

  // --- HANDLERS ---
  const handleUpdateCell = (r: number, c: number, val: string, commit = false) => {
      const id = getCellId(r, c);
      const newCells = { ...cells, [id]: { ...cells[id], value: val } };
      
      if (commit) {
          const computedCells = recalculateAll(newCells);
          setCells(computedCells);
          saveToHistory();
      } else {
          setCells(newCells);
      }
  };

  const applyFormat = (styleUpdate: Partial<CellStyle>) => {
      const newCells = { ...cells };
      let changed = false;

      selections.forEach(range => {
          const minR = Math.min(range.start.r, range.end.r);
          const maxR = Math.max(range.start.r, range.end.r);
          const minC = Math.min(range.start.c, range.end.c);
          const maxC = Math.max(range.start.c, range.end.c);

          for(let r = minR; r <= maxR; r++) {
              for(let c = minC; c <= maxC; c++) {
                  const id = getCellId(r, c);
                  if(!newCells[id]) newCells[id] = { value: '', computed: '' };
                  
                  newCells[id] = {
                      ...newCells[id],
                      style: { ...newCells[id].style, ...styleUpdate }
                  };
                  changed = true;
              }
          }
      });

      if(changed) {
          setCells(newCells);
          saveToHistory();
      }
  };

  const handleFormatAsTable = () => {
      // Formata como tabela zebrada (Alternating Colors)
      if (selections.length === 0) return;
      const range = selections[0];
      const minR = Math.min(range.start.r, range.end.r);
      const maxR = Math.max(range.start.r, range.end.r);
      const minC = Math.min(range.start.c, range.end.c);
      const maxC = Math.max(range.start.c, range.end.c);

      const newCells = { ...cells };
      
      for(let r = minR; r <= maxR; r++) {
          const isHeader = r === minR;
          const isEven = (r - minR) % 2 === 0;
          
          for(let c = minC; c <= maxC; c++) {
              const id = getCellId(r, c);
              if(!newCells[id]) newCells[id] = { value: '' };

              if (isHeader) {
                  newCells[id].style = { ...newCells[id].style, bg: '#2563eb', color: '#ffffff', bold: true, align: 'center' };
              } else if (isEven) {
                   newCells[id].style = { ...newCells[id].style, bg: '#eff6ff' };
              } else {
                   newCells[id].style = { ...newCells[id].style, bg: '#ffffff' };
              }
          }
      }
      setCells(newCells);
      saveToHistory();
  };

  // --- SELECTION LOGIC ---
  const handleMouseDown = (e: React.MouseEvent, r: number, c: number) => {
      // Left Click
      if(e.button === 0) {
        setContextMenu(null);
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if(isShift && activeCell) {
            const newSelection = { start: activeCell, end: { r, c } };
            setSelections(isCtrl ? [...selections, newSelection] : [newSelection]);
        } else if (isCtrl) {
            setActiveCell({ r, c });
            setSelections([...selections, { start: { r, c }, end: { r, c } }]);
        } else {
            setActiveCell({ r, c });
            setSelections([{ start: { r, c }, end: { r, c } }]);
        }
        setIsDragging(true);
      }
      // Right Click
      else if (e.button === 2) {
          e.preventDefault();
          // Se clicou fora da seleção, seleciona a célula nova
          if (!isSelected(r, c)) {
              setActiveCell({ r, c });
              setSelections([{ start: { r, c }, end: { r, c } }]);
          }
          setContextMenu({ x: e.clientX, y: e.clientY, target: 'selection' });
      }
  };

  const handleMouseEnter = (r: number, c: number) => {
      if(isDragging && selections.length > 0) {
          const currentSelections = [...selections];
          const lastIndex = currentSelections.length - 1;
          currentSelections[lastIndex] = {
              ...currentSelections[lastIndex],
              end: { r, c }
          };
          setSelections(currentSelections);
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      resizeRef.current = null;
  };

  // --- CONTEXT MENU ACTIONS ---
  const handleContextAction = (action: string) => {
      setContextMenu(null);
      if (selections.length === 0) return;

      const newCells = { ...cells };
      const range = selections[selections.length-1];
      const minR = Math.min(range.start.r, range.end.r);
      const maxR = Math.max(range.start.r, range.end.r);
      const minC = Math.min(range.start.c, range.end.c);
      const maxC = Math.max(range.start.c, range.end.c);

      switch(action) {
          case 'clear':
              for(let r=minR; r<=maxR; r++) {
                  for(let c=minC; c<=maxC; c++) {
                      const id = getCellId(r, c);
                      if (newCells[id]) delete newCells[id];
                  }
              }
              setCells(recalculateAll(newCells));
              saveToHistory();
              break;
          
          case 'copy':
              // Lógica simples de cópia para clipboard (Tab separated)
              let text = '';
              for(let r=minR; r<=maxR; r++) {
                  for(let c=minC; c<=maxC; c++) {
                      const id = getCellId(r, c);
                      text += (newCells[id]?.computed ?? newCells[id]?.value ?? '') + '\t';
                  }
                  text += '\n';
              }
              navigator.clipboard.writeText(text);
              addToast({ type: 'info', title: 'Copiado', message: 'Conteúdo copiado.' });
              break;

          case 'delete_row':
              // Remove linha e sobe as outras
              // Implementação simplificada: apaga dados da linha
              for(let r=minR; r<=maxR; r++) {
                  for(let c=0; c<DEFAULT_COLS; c++) {
                      delete newCells[getCellId(r, c)];
                  }
              }
              setCells(recalculateAll(newCells));
              saveToHistory();
              break;
      }
  };

  // --- GLOBAL EVENTS (Close Menu) ---
  useEffect(() => {
      const handleClick = (e: MouseEvent) => {
          if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
              setContextMenu(null);
          }
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
  }, []);

  // --- SAVE & EXPORT ---
  const handleSave = async () => {
      setIsSaving(true);
      try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Planilha1');

          Object.entries(cells).forEach(([key, rawData]) => {
              const data = rawData as CellData;
              const cell = sheet.getCell(key);
              
              if (data.value.startsWith('=')) {
                  cell.value = { formula: data.value.substring(1), result: data.computed as any };
              } else {
                  cell.value = data.computed as any;
              }
              // Styles
              if(data.style) {
                  if(data.style.bold) cell.font = { ...cell.font, bold: true };
                  if(data.style.italic) cell.font = { ...cell.font, italic: true };
                  if(data.style.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.style.bg.replace('#', '') } };
              }
          });

          const buffer = await workbook.xlsx.writeBuffer();
          const file = new File([buffer], filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Arquivo atualizado no Drive.' });
          setWindowDirty(windowId, false);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  // Sync Input Formula
  useEffect(() => {
      if(activeCell) {
          const id = getCellId(activeCell.r, activeCell.c);
          setFormulaInput(cells[id]?.value || '');
      }
  }, [activeCell, cells]);

  const isSelected = (r: number, c: number) => {
      return selections.some(range => 
          r >= Math.min(range.start.r, range.end.r) &&
          r <= Math.max(range.start.r, range.end.r) &&
          c >= Math.min(range.start.c, range.end.c) &&
          c <= Math.max(range.start.c, range.end.c)
      );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] text-black select-none overflow-hidden relative">
        
        {/* TOP BAR */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-300 bg-white shrink-0">
             <div className="flex items-center gap-2">
                 <div className="p-1 bg-green-600 rounded text-white"><FileSpreadsheet className="w-4 h-4" /></div>
                 <Input 
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="h-7 w-48 border-transparent hover:border-zinc-300 focus:border-green-600 font-semibold bg-transparent px-2"
                />
             </div>
             <div className="flex gap-1">
                 <Button size="icon" variant="ghost" onClick={undo} disabled={historyIndex <= 0} className="h-7 w-7"><Undo2 className="w-4 h-4" /></Button>
                 <Button size="icon" variant="ghost" onClick={redo} disabled={historyIndex >= history.length - 1} className="h-7 w-7"><Redo2 className="w-4 h-4" /></Button>
                 <div className="w-px h-4 bg-zinc-300 mx-1 self-center" />
                 <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 bg-green-600 hover:bg-green-700 text-white gap-2">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                 </Button>
             </div>
        </div>

        {/* RIBBON */}
        <div className="bg-zinc-100 border-b border-zinc-300 shrink-0">
            <div className="h-12 bg-white flex items-center px-4 gap-4 overflow-x-auto">
                 {/* Formatting */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ bold: true })} className="h-8 w-8 hover:bg-zinc-100 font-bold"><Bold className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ italic: true })} className="h-8 w-8 hover:bg-zinc-100 italic"><Italic className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ underline: true })} className="h-8 w-8 hover:bg-zinc-100 underline"><Underline className="w-4 h-4" /></Button>
                 </div>
                 {/* Alignment */}
                 <div className="flex gap-1 pr-4 border-r border-zinc-200">
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'left' })} className="h-8 w-8"><AlignLeft className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'center' })} className="h-8 w-8"><AlignCenter className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'right' })} className="h-8 w-8"><AlignRight className="w-4 h-4" /></Button>
                 </div>
                 {/* Color & Table */}
                 <div className="flex gap-2 items-center">
                    <label className="cursor-pointer hover:bg-zinc-100 p-1.5 rounded flex flex-col items-center">
                        <PaintBucket className="w-4 h-4 mb-0.5" />
                        <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => applyFormat({ bg: e.target.value })} />
                        <div className="w-4 h-1 bg-yellow-400"></div>
                    </label>
                    <label className="cursor-pointer hover:bg-zinc-100 p-1.5 rounded flex flex-col items-center">
                        <Type className="w-4 h-4 mb-0.5" />
                        <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => applyFormat({ color: e.target.value })} />
                        <div className="w-4 h-1 bg-black"></div>
                    </label>
                    <Button size="sm" variant="ghost" onClick={handleFormatAsTable} className="text-xs gap-2 border border-dashed border-zinc-300">
                        <TableIcon className="w-4 h-4" /> Formatar Tabela
                    </Button>
                 </div>
            </div>
        </div>

        {/* FORMULA BAR */}
        <div className="flex items-center px-2 py-1 gap-2 bg-white border-b border-zinc-300 shrink-0">
            <div className="w-10 text-center text-xs font-bold text-zinc-500 bg-zinc-100 rounded border border-zinc-200 py-0.5">
                {activeCell ? getCellId(activeCell.r, activeCell.c) : ''}
            </div>
            <div className="text-zinc-400 font-serif italic text-sm px-1">fx</div>
            <input 
                ref={inputRef}
                className="flex-1 h-6 text-sm outline-none pl-2 focus:bg-blue-50 transition-colors font-mono text-zinc-700"
                value={formulaInput}
                onChange={(e) => {
                    setFormulaInput(e.target.value);
                    if (activeCell) handleUpdateCell(activeCell.r, activeCell.c, e.target.value);
                }}
                onKeyDown={(e) => {
                    if(e.key === 'Enter' && activeCell) {
                        handleUpdateCell(activeCell.r, activeCell.c, formulaInput, true);
                    }
                }}
                onBlur={() => { if(activeCell) handleUpdateCell(activeCell.r, activeCell.c, formulaInput, true); }}
            />
        </div>

        {/* GRID AREA */}
        <div className="flex-1 overflow-auto relative custom-scrollbar bg-zinc-200" ref={gridRef}>
            <div className="relative bg-white" style={{ minWidth: '100%', width: 'max-content' }}>
                
                {/* HEADERS */}
                <div className="flex sticky top-0 z-20 shadow-sm">
                    <div className="w-[40px] h-[24px] bg-zinc-100 border-r border-b border-zinc-300 shrink-0 sticky left-0 z-30 flex items-center justify-center">
                        <Grid className="w-3 h-3 text-zinc-400" />
                    </div>
                    {Array.from({ length: DEFAULT_COLS }).map((_, c) => (
                        <div 
                            key={c} 
                            className="h-[24px] border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors relative"
                            style={{ width: colWidths[c] || DEFAULT_CELL_WIDTH }}
                        >
                            {getColName(c)}
                        </div>
                    ))}
                </div>

                {/* ROWS */}
                {Array.from({ length: DEFAULT_ROWS }).map((_, r) => (
                    <div key={r} className="flex" style={{ height: rowHeights[r] || DEFAULT_CELL_HEIGHT }}>
                        <div className="w-[40px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-600 sticky left-0 z-10 hover:bg-zinc-200 cursor-pointer">
                            {r + 1}
                        </div>

                        {Array.from({ length: DEFAULT_COLS }).map((_, c) => {
                            const id = getCellId(r, c);
                            const cell = cells[id];
                            const selected = isSelected(r, c);
                            const active = activeCell?.r === r && activeCell?.c === c;
                            const width = colWidths[c] || DEFAULT_CELL_WIDTH;

                            return (
                                <div
                                    key={id}
                                    className={cn(
                                        "border-r border-b border-zinc-200 text-xs px-1 outline-none truncate relative cursor-cell",
                                        selected ? "bg-blue-50" : "bg-white",
                                        active && "ring-2 ring-green-600 z-10 bg-white",
                                        selected && "border-blue-200"
                                    )}
                                    style={{ 
                                        width,
                                        fontWeight: cell?.style?.bold ? 'bold' : 'normal',
                                        fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                                        textDecoration: cell?.style?.underline ? 'underline' : 'none',
                                        textAlign: cell?.style?.align || 'left',
                                        backgroundColor: selected && !cell?.style?.bg ? undefined : cell?.style?.bg,
                                        color: cell?.style?.color
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, r, c)}
                                    onMouseEnter={() => handleMouseEnter(r, c)}
                                    onContextMenu={(e) => handleMouseDown(e, r, c)} // Garante seleção no right click
                                >
                                    <div className="w-full h-full flex items-center overflow-hidden pointer-events-none">
                                        {cell?.computed ?? cell?.value ?? ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>

        {/* CONTEXT MENU */}
        {contextMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
                <div 
                    ref={contextMenuRef}
                    className="fixed z-50 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 w-48 text-sm animate-in fade-in zoom-in-95"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button onClick={() => handleContextAction('copy')} className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5 text-zinc-500" /> Copiar
                    </button>
                    <div className="h-px bg-zinc-200 my-1" />
                    <button onClick={() => handleContextAction('clear')} className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center gap-2 text-red-600">
                        <Eraser className="w-3.5 h-3.5" /> Limpar Conteúdo
                    </button>
                    <button onClick={() => handleContextAction('delete_row')} className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center gap-2 text-red-600">
                        <Trash className="w-3.5 h-3.5" /> Excluir Linha
                    </button>
                </div>
            </>
        )}

        {/* STATUS BAR */}
        <div className="h-6 bg-zinc-100 border-t border-zinc-300 flex items-center px-3 justify-between text-[10px] text-zinc-500 shrink-0">
             <div>Pronto</div>
             {selections.length > 0 && (
                 <div className="flex gap-4">
                     <span>Média: {evaluateFormula(`AVG(${getCellId(selections[0].start.r, selections[0].start.c)}:${getCellId(selections[0].end.r, selections[0].end.c)})`, cells)}</span>
                     <span>Soma: {evaluateFormula(`SUM(${getCellId(selections[0].start.r, selections[0].start.c)}:${getCellId(selections[0].end.r, selections[0].end.c)})`, cells)}</span>
                 </div>
             )}
        </div>
    </div>
  );
}
