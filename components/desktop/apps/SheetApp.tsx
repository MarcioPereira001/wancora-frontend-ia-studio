'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Save, FileSpreadsheet, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    Undo2, Redo2, Plus, Trash, ArrowDown, ArrowRight, Loader2, Grid, 
    ChevronDown, PaintBucket, Type, Calculator, Copy, Clipboard, Eraser, Table
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
const HEADER_SIZE = 40;

// --- TIPAGEM ---
interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    bg?: string;
    color?: string;
    fontSize?: number;
}

interface CellData {
    value: string; // O que o usuário digitou (ex: "=SUM(A1:A5)")
    computed?: string | number | null; // O resultado (ex: 50)
    style?: CellStyle;
    type?: 'text' | 'number' | 'error';
}

interface SelectionRange {
    start: { r: number, c: number };
    end: { r: number, c: number };
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

// --- MOTOR DE FÓRMULAS (SIMPLIFICADO) ---
const evaluateFormula = (expression: string, cells: Record<string, CellData>): string | number => {
    if (!expression.startsWith('=')) return isNaN(Number(expression)) ? expression : Number(expression);

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
                    const val = cells[id]?.computed || cells[id]?.value || 0;
                    values.push(Number(val) || 0);
                }
            }
            return `[${values.join(',')}]`;
        });

        // 2. Resolve Referências Únicas (ex: A1)
        cleanExpr = cleanExpr.replace(/[A-Z]+[0-9]+/g, (match) => {
            const val = cells[match]?.computed || cells[match]?.value || 0;
            return isNaN(Number(val)) ? `"${val}"` : String(val);
        });

        // 3. Funções (Implementação básica)
        // SUM([1,2,3]) -> 6
        if (cleanExpr.includes('SUM(')) {
            cleanExpr = cleanExpr.replace(/SUM\((.*?)\)/g, (_, args) => {
                // Remove colchetes de array se houver e faz split
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return String(nums.reduce((a: number, b: number) => a + b, 0));
            });
        }
        
        // AVG([1,2,3]) -> 2
        if (cleanExpr.includes('AVG(') || cleanExpr.includes('MEDIA(')) {
            cleanExpr = cleanExpr.replace(/(AVG|MEDIA)\((.*?)\)/g, (_, __, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return nums.length ? String(nums.reduce((a: number, b: number) => a + b, 0) / nums.length) : "0";
            });
        }

        // IF(cond, true, false) - Basic JS conversion
        // Note: This uses Function constructor which is risky in public apps, but acceptable for internal tools.
        // Replace Excel syntax IF with JS ternary manually or rely on JS eval boolean logic
        cleanExpr = cleanExpr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");

        // 4. Eval Final
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${cleanExpr}`)();
        return result;

    } catch (e) {
        console.error(e);
        return "#ERRO";
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
  
  // Dimensions
  const [colWidths, setColWidths] = useState<Record<number, number>>(initialState.colWidths || {});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(initialState.rowHeights || {});

  // Selection
  const [activeCell, setActiveCell] = useState<{r: number, c: number} | null>(null);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // UI
  const [activeTab, setActiveTab] = useState<'home' | 'data' | 'view'>('home');
  const [formulaInput, setFormulaInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copyBuffer, setCopyBuffer] = useState<{cells: Record<string, CellData>, range: SelectionRange} | null>(null);

  // Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // --- RECALCULATION LOOP ---
  // Quando uma célula muda, recalcular toda a planilha (Naive approach for MVP)
  // Em prod, usaria um grafo de dependência.
  const recalculateAll = (currentCells: Record<string, CellData>) => {
      const nextCells = { ...currentCells };
      // 1. Pass: Raw values
      // 2. Pass: Compute Formulas
      Object.keys(nextCells).forEach(key => {
          const cell = nextCells[key];
          if(cell.value.startsWith('=')) {
              cell.computed = evaluateFormula(cell.value, nextCells);
          } else {
              // Tenta converter pra número se possível
              const num = Number(cell.value);
              cell.computed = isNaN(num) ? cell.value : num;
          }
      });
      return nextCells;
  };

  // --- HANDLERS ---

  const handleUpdateCell = (r: number, c: number, val: string, commit = false) => {
      const id = getCellId(r, c);
      const newCells = { ...cells, [id]: { ...cells[id], value: val } };
      
      // Apenas recalcula se for commit (Enter/Blur) para performance
      if (commit) {
          const computedCells = recalculateAll(newCells);
          setCells(computedCells);
          saveToHistory();
          setWindowDirty(windowId, true);
      } else {
          setCells(newCells);
      }
  };

  const applyFormat = (styleUpdate: Partial<CellStyle>) => {
      const newCells = { ...cells };
      let changed = false;

      // Aplica a todas as células selecionadas
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
          setWindowDirty(windowId, true);
      }
  };

  // --- SELECTION LOGIC ---
  const handleMouseDown = (e: React.MouseEvent, r: number, c: number) => {
      if(e.button !== 0) return; // Only Left Click
      
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if(isShift && activeCell) {
          // Expandir seleção atual
          const lastSelection = selections[selections.length - 1];
          const newSelection = { start: activeCell, end: { r, c } };
          setSelections(isCtrl ? [...selections, newSelection] : [newSelection]); // Se ctrl não ta apertado, substitui tudo pelo range
      } else if (isCtrl) {
          // Adicionar nova seleção isolada
          setActiveCell({ r, c });
          setSelections([...selections, { start: { r, c }, end: { r, c } }]);
      } else {
          // Nova seleção única
          setActiveCell({ r, c });
          setSelections([{ start: { r, c }, end: { r, c } }]);
      }
      setIsDragging(true);
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

  // --- KEYBOARD NAV ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if(!activeCell) return;
          
          // Delete
          if(e.key === 'Delete' || e.key === 'Backspace') {
              const newCells = { ...cells };
              selections.forEach(range => {
                  for(let r=Math.min(range.start.r, range.end.r); r<=Math.max(range.start.r, range.end.r); r++){
                      for(let c=Math.min(range.start.c, range.end.c); c<=Math.max(range.start.c, range.end.c); c++){
                          delete newCells[getCellId(r, c)];
                      }
                  }
              });
              setCells(recalculateAll(newCells));
              saveToHistory();
              return;
          }

          // Navigation
          if(!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
          // Se estiver editando input, não navega
          if(document.activeElement?.tagName === 'INPUT' && document.activeElement !== document.body) return;

          e.preventDefault();
          let { r, c } = activeCell;
          if(e.key === 'ArrowUp') r = Math.max(0, r - 1);
          if(e.key === 'ArrowDown') r = Math.min(DEFAULT_ROWS - 1, r + 1);
          if(e.key === 'ArrowLeft') c = Math.max(0, c - 1);
          if(e.key === 'ArrowRight') c = Math.min(DEFAULT_COLS - 1, c + 1);

          setActiveCell({ r, c });
          if(!e.shiftKey) setSelections([{ start: { r, c }, end: { r, c } }]);
          else {
              // Logic expand selection
              const last = selections[selections.length - 1];
              setSelections([...selections.slice(0, -1), { ...last, end: { r, c } }]);
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [activeCell, selections, cells]);

  // --- RESIZE LOGIC ---
  const startResize = (e: React.MouseEvent, type: 'col'|'row', index: number) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
          type,
          index,
          start: type === 'col' ? e.clientX : e.clientY,
          startSize: type === 'col' ? (colWidths[index] || DEFAULT_CELL_WIDTH) : (rowHeights[index] || DEFAULT_CELL_HEIGHT)
      };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
      if(!resizeRef.current) return;
      const { type, index, start, startSize } = resizeRef.current;
      const current = type === 'col' ? e.clientX : e.clientY;
      const diff = current - start;
      const newSize = Math.max(20, startSize + diff);

      if(type === 'col') setColWidths({ ...colWidths, [index]: newSize });
      else setRowHeights({ ...rowHeights, [index]: newSize });
  };

  // --- SAVE & EXPORT ---
  const handleSave = async () => {
      setIsSaving(true);
      try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Planilha1');

          // Config Cols
          const cols = [];
          for(let i=0; i<DEFAULT_COLS; i++) {
              if(colWidths[i]) cols.push({ width: colWidths[i] / 7 });
          }
          if(cols.length) sheet.columns = cols;

          // Cells
          Object.entries(cells).forEach(([key, rawData]) => {
              const data = rawData as CellData;
              const cell = sheet.getCell(key);
              
              if (data.value.startsWith('=')) {
                  cell.value = { formula: data.value.substring(1), result: data.computed as any };
              } else {
                  cell.value = data.computed as any;
              }

              if(data.style) {
                  if(data.style.bold) cell.font = { ...cell.font, bold: true };
                  if(data.style.italic) cell.font = { ...cell.font, italic: true };
                  if(data.style.underline) cell.font = { ...cell.font, underline: true };
                  if(data.style.color) cell.font = { ...cell.font, color: { argb: data.style.color.replace('#', '') } };
                  if(data.style.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.style.bg.replace('#', '') } };
                  if(data.style.align) cell.alignment = { horizontal: data.style.align };
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

  // --- RENDER HELPERS ---
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
               // Seleção total da coluna? (Se rows cobrirem tudo)
               return index >= Math.min(range.start.c, range.end.c) && index <= Math.max(range.start.c, range.end.c);
           } else {
               return index >= Math.min(range.start.r, range.end.r) && index <= Math.max(range.start.r, range.end.r);
           }
      });
  };

  return (
    <div 
        className="flex flex-col h-full bg-[#f8f9fa] text-black select-none overflow-hidden" 
        onMouseMove={handleResizeMove}
    >
        
        {/* === TOP BAR (TITLE) === */}
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

        {/* === RIBBON (TABS) === */}
        <div className="bg-zinc-100 border-b border-zinc-300 shrink-0">
            <div className="flex px-2 pt-1 gap-1 border-b border-zinc-300">
                {['Home', 'Data', 'View'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab.toLowerCase() as any)}
                        className={cn(
                            "px-4 py-1 text-xs rounded-t-lg transition-colors border-b-2 mb-[-1px]",
                            activeTab === tab.toLowerCase() 
                                ? "bg-white border-green-600 text-green-700 font-bold" 
                                : "text-zinc-500 border-transparent hover:bg-zinc-200"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* RIBBON CONTENT */}
            <div className="h-14 bg-white flex items-center px-4 gap-4 overflow-x-auto">
                {activeTab === 'home' && (
                    <>
                        {/* Clipboard */}
                        <div className="flex flex-col items-center gap-1 pr-4 border-r border-zinc-200">
                             <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6"><Copy className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6"><Clipboard className="w-3 h-3" /></Button>
                             </div>
                             <span className="text-[9px] text-zinc-400">Clipboard</span>
                        </div>

                        {/* Font */}
                        <div className="flex flex-col items-center gap-1 pr-4 border-r border-zinc-200">
                             <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ bold: true })} className="h-6 w-6 hover:bg-zinc-100 font-bold"><Bold className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ italic: true })} className="h-6 w-6 hover:bg-zinc-100 italic"><Italic className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ underline: true })} className="h-6 w-6 hover:bg-zinc-100 underline"><Underline className="w-3 h-3" /></Button>
                             </div>
                             <span className="text-[9px] text-zinc-400">Fonte</span>
                        </div>

                        {/* Alignment */}
                        <div className="flex flex-col items-center gap-1 pr-4 border-r border-zinc-200">
                             <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'left' })} className="h-6 w-6"><AlignLeft className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'center' })} className="h-6 w-6"><AlignCenter className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => applyFormat({ align: 'right' })} className="h-6 w-6"><AlignRight className="w-3 h-3" /></Button>
                             </div>
                             <span className="text-[9px] text-zinc-400">Alinhamento</span>
                        </div>

                        {/* Color */}
                        <div className="flex flex-col items-center gap-1 pr-4 border-r border-zinc-200">
                             <div className="flex gap-2">
                                <label className="cursor-pointer hover:bg-zinc-100 p-1 rounded flex flex-col items-center">
                                    <PaintBucket className="w-3 h-3 mb-0.5" />
                                    <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => applyFormat({ bg: e.target.value })} />
                                    <div className="w-4 h-1 bg-yellow-400"></div>
                                </label>
                                <label className="cursor-pointer hover:bg-zinc-100 p-1 rounded flex flex-col items-center">
                                    <Type className="w-3 h-3 mb-0.5" />
                                    <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => applyFormat({ color: e.target.value })} />
                                    <div className="w-4 h-1 bg-red-500"></div>
                                </label>
                             </div>
                             <span className="text-[9px] text-zinc-400">Cores</span>
                        </div>

                        {/* Utils */}
                        <div className="flex flex-col items-center gap-1">
                             <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6"><Eraser className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6"><Table className="w-3 h-3" /></Button>
                             </div>
                             <span className="text-[9px] text-zinc-400">Ferramentas</span>
                        </div>
                    </>
                )}
                {activeTab !== 'home' && <div className="text-xs text-zinc-400 p-2 italic">Ferramentas avançadas em breve...</div>}
            </div>
        </div>

        {/* === FORMULA BAR === */}
        <div className="flex items-center px-2 py-1 gap-2 bg-white border-b border-zinc-300 shrink-0">
            <div className="w-10 text-center text-xs font-bold text-zinc-500 bg-zinc-100 rounded border border-zinc-200 py-0.5">
                {activeCell ? getCellId(activeCell.r, activeCell.c) : ''}
            </div>
            <div className="text-zinc-400 font-serif italic text-sm px-1 cursor-pointer hover:text-black">fx</div>
            <div className="h-6 w-px bg-zinc-300" />
            <input 
                ref={inputRef}
                className="flex-1 h-6 text-sm outline-none pl-2 focus:bg-blue-50 transition-colors font-mono text-zinc-700"
                value={formulaInput}
                onChange={(e) => {
                    setFormulaInput(e.target.value);
                    if (activeCell) handleUpdateCell(activeCell.r, activeCell.c, e.target.value);
                }}
                onKeyDown={(e) => {
                    if(e.key === 'Enter') {
                        if (activeCell) handleUpdateCell(activeCell.r, activeCell.c, formulaInput, true);
                        // Move down logic can be added here
                    }
                }}
                onBlur={() => { if(activeCell) handleUpdateCell(activeCell.r, activeCell.c, formulaInput, true); }}
            />
        </div>

        {/* === GRID AREA === */}
        <div className="flex-1 overflow-auto relative custom-scrollbar bg-zinc-200" ref={gridRef}>
            <div className="relative bg-white" style={{ minWidth: '100%', width: 'max-content' }}>
                
                {/* 1. COLUMN HEADERS (A, B, C...) */}
                <div className="flex sticky top-0 z-20 shadow-sm">
                    <div 
                        className="w-[40px] h-[24px] bg-zinc-100 border-r border-b border-zinc-300 shrink-0 sticky left-0 z-30 flex items-center justify-center text-zinc-400 text-[10px] cursor-pointer hover:bg-zinc-200"
                        onClick={() => {
                            setSelections([{ start: { r: 0, c: 0 }, end: { r: DEFAULT_ROWS - 1, c: DEFAULT_COLS - 1 } }]);
                        }}
                    >
                        <Grid className="w-3 h-3" />
                    </div>
                    {Array.from({ length: DEFAULT_COLS }).map((_, c) => {
                        const width = colWidths[c] || DEFAULT_CELL_WIDTH;
                        const isSel = isHeadSelected(c, 'col');
                        return (
                            <div 
                                key={c} 
                                className={cn(
                                    "h-[24px] border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 relative group select-none transition-colors",
                                    isSel ? "bg-green-100 text-green-700 border-b-green-500" : "bg-zinc-100 hover:bg-zinc-200"
                                )}
                                style={{ width }}
                                onClick={(e) => {
                                    if(e.shiftKey) {
                                        // TODO: Range cols
                                    } else {
                                        setSelections([{ start: { r: 0, c }, end: { r: DEFAULT_ROWS - 1, c } }]);
                                    }
                                }}
                            >
                                {getColName(c)}
                                {/* Resizer */}
                                <div 
                                    className="absolute right-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-green-500 opacity-0 group-hover:opacity-100 z-10"
                                    onMouseDown={(e) => startResize(e, 'col', c)}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* 2. ROWS & CELLS */}
                {Array.from({ length: DEFAULT_ROWS }).map((_, r) => {
                    const height = rowHeights[r] || DEFAULT_CELL_HEIGHT;
                    return (
                        <div key={r} className="flex" style={{ height }}>
                            {/* Row Index */}
                            <div 
                                className={cn(
                                    "w-[40px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-600 sticky left-0 z-10 relative group select-none transition-colors cursor-pointer hover:bg-zinc-200",
                                    isHeadSelected(r, 'row') ? "bg-green-100 text-green-700 border-r-green-500" : ""
                                )}
                                onClick={() => setSelections([{ start: { r, c: 0 }, end: { r, c: DEFAULT_COLS - 1 } }])}
                            >
                                {r + 1}
                                <div 
                                    className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize hover:bg-green-500 opacity-0 group-hover:opacity-100 z-10"
                                    onMouseDown={(e) => startResize(e, 'row', r)}
                                />
                            </div>

                            {/* Cells */}
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
                                            // Selection Borders (Simplificado para performance)
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
                                        onDoubleClick={() => {
                                            setActiveCell({ r, c });
                                            setTimeout(() => inputRef.current?.focus(), 10);
                                        }}
                                    >
                                        <div className="w-full h-full flex items-center overflow-hidden pointer-events-none">
                                            {cell?.computed ?? cell?.value ?? ''}
                                        </div>
                                        
                                        {/* Fill Handle (Apenas na célula ativa se for o fim da seleção) */}
                                        {active && selections.length > 0 && 
                                         r === Math.max(selections[selections.length-1].start.r, selections[selections.length-1].end.r) &&
                                         c === Math.max(selections[selections.length-1].start.c, selections[selections.length-1].end.c) && (
                                            <div 
                                                className="absolute bottom-[-3px] right-[-3px] w-2 h-2 bg-green-600 border border-white cursor-crosshair z-20"
                                                onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true); /* TODO: Implement Fill Logic */ }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>

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