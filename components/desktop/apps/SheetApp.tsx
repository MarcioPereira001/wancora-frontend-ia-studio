'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, FileSpreadsheet, Undo2, Redo2, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import ExcelJS from 'exceljs';

// Imports Modulares
import { SheetToolbar } from './sheet/SheetToolbar';
import { SheetGrid } from './sheet/SheetGrid';
import { SheetContextMenu } from './sheet/SheetContextMenu';
import { CellData, SheetState, SelectionRange, CellStyle } from './sheet/types';
import { DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_CELL_WIDTH, DEFAULT_CELL_HEIGHT, getCellId, evaluateFormula } from './sheet/utils';

export function SheetApp({ windowId }: { windowId: string }) {
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  // --- GLOBAL STATE ---
  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Nova Planilha'));
  const [cells, setCells] = useState<Record<string, CellData>>(initialState.cells || {});
  const [colWidths, setColWidths] = useState<Record<number, number>>(initialState.colWidths || {});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(initialState.rowHeights || {});

  // --- HISTORY ---
  const [history, setHistory] = useState<SheetState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // --- SELECTION & INTERACTION ---
  const [activeCell, setActiveCell] = useState<{r: number, c: number} | null>(null);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<{ type: 'col'|'row', index: number, start: number, startSize: number } | null>(null);

  // --- HISTORY LOGIC ---
  const saveToHistory = useCallback(() => {
      const state: SheetState = { cells, colWidths, rowHeights };
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(state)));
      if (newHistory.length > 50) newHistory.shift();
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setWindowDirty(windowId, true);
  }, [cells, colWidths, rowHeights, history, historyIndex, windowId]);

  const undo = () => {
      if (historyIndex > 0) {
          const prev = history[historyIndex - 1];
          setCells(prev.cells);
          setColWidths(prev.colWidths);
          setRowHeights(prev.rowHeights);
          setHistoryIndex(historyIndex - 1);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          const next = history[historyIndex + 1];
          setCells(next.cells);
          setColWidths(next.colWidths);
          setRowHeights(next.rowHeights);
          setHistoryIndex(historyIndex + 1);
      }
  };

  // Init History
  useEffect(() => {
      if (history.length === 0) saveToHistory();
  }, []);

  // --- CORE LOGIC: Recalculate ---
  const recalculateAll = (currentCells: Record<string, CellData>) => {
      const nextCells = { ...currentCells };
      Object.keys(nextCells).forEach(key => {
          const cell = nextCells[key];
          if(cell.value && cell.value.toString().startsWith('=')) {
              cell.computed = evaluateFormula(cell.value, nextCells);
          } else {
              // Correção BUG DO 0: Se string vazia, computed = vazio.
              const val = cell.value;
              if (val === '' || val === null || val === undefined) {
                  cell.computed = '';
              } else {
                  const num = Number(val);
                  cell.computed = isNaN(num) ? val : num;
              }
          }
      });
      return nextCells;
  };

  const updateCell = (r: number, c: number, val: string, commit = false) => {
      const id = getCellId(r, c);
      const newCells = { ...cells, [id]: { ...cells[id], value: val } };
      
      if (commit) {
          const computed = recalculateAll(newCells);
          setCells(computed);
          saveToHistory();
      } else {
          setCells(newCells);
      }
  };

  // --- MOUSE HANDLERS (Selection) ---
  const handleMouseDown = (e: React.MouseEvent, r: number, c: number) => {
      if (e.button === 2) { // Right Click
           e.preventDefault();
           // Se clicou fora da seleção atual, seleciona a célula
           if (!selections.some(s => r >= Math.min(s.start.r, s.end.r) && r <= Math.max(s.start.r, s.end.r) && c >= Math.min(s.start.c, s.end.c) && c <= Math.max(s.start.c, s.end.c))) {
                setActiveCell({ r, c });
                setSelections([{ start: { r, c }, end: { r, c } }]);
           }
           setContextMenu({ x: e.clientX, y: e.clientY, r, c });
           return;
      }
      
      setContextMenu(null);
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (isShift && activeCell) {
          const lastSel = selections[selections.length - 1];
          const newSel = { start: activeCell, end: { r, c } };
          setSelections(isCtrl ? [...selections, newSel] : [newSel]);
      } else if (isCtrl) {
          setActiveCell({ r, c });
          setSelections([...selections, { start: { r, c }, end: { r, c } }]);
      } else {
          setActiveCell({ r, c });
          setSelections([{ start: { r, c }, end: { r, c } }]);
      }
      setIsDragging(true);
  };

  const handleMouseEnter = (r: number, c: number) => {
      if (isDragging && selections.length > 0) {
          const current = [...selections];
          current[current.length - 1].end = { r, c };
          setSelections(current);
      }
  };

  const handleFillHandleDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsFillDragging(true);
      // Logic for fill drag start... (Reuse existing selection for visualization)
      setIsDragging(true);
  };

  const handleGlobalMouseUp = () => {
      if (isFillDragging && activeCell && selections.length > 0) {
          // AUTO-FILL LOGIC
          const range = selections[selections.length - 1];
          const sourceId = getCellId(activeCell.r, activeCell.c);
          const sourceData = cells[sourceId];
          
          if (sourceData) {
              const newCells = { ...cells };
              const minR = Math.min(range.start.r, range.end.r);
              const maxR = Math.max(range.start.r, range.end.r);
              const minC = Math.min(range.start.c, range.end.c);
              const maxC = Math.max(range.start.c, range.end.c);
              
              for(let r = minR; r <= maxR; r++) {
                  for(let c = minC; c <= maxC; c++) {
                      const targetId = getCellId(r, c);
                      if (targetId !== sourceId) {
                          newCells[targetId] = { ...sourceData }; // Clone value & style
                      }
                  }
              }
              setCells(recalculateAll(newCells));
              saveToHistory();
          }
      }
      
      setIsDragging(false);
      setIsFillDragging(false);
      resizeRef.current = null;
  };

  // --- RESIZE LOGIC ---
  const handleResizeStart = (e: React.MouseEvent, type: 'col' | 'row', index: number) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
          type, index, start: type === 'col' ? e.clientX : e.clientY,
          startSize: type === 'col' ? (colWidths[index] || DEFAULT_CELL_WIDTH) : (rowHeights[index] || DEFAULT_CELL_HEIGHT)
      };
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { type, index, start, startSize } = resizeRef.current;
      const delta = (type === 'col' ? e.clientX : e.clientY) - start;
      const newSize = Math.max(20, startSize + delta);
      
      if (type === 'col') setColWidths(prev => ({ ...prev, [index]: newSize }));
      else setRowHeights(prev => ({ ...prev, [index]: newSize }));
  }, []);

  useEffect(() => {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
  }, [isFillDragging, activeCell, selections]); // Deps needed for fill logic closure

  // --- TOOLBAR ACTIONS ---
  const applyFormat = (style: Partial<CellStyle>) => {
      const newCells = { ...cells };
      let changed = false;

      selections.forEach(range => {
          const minR = Math.min(range.start.r, range.end.r);
          const maxR = Math.max(range.start.r, range.end.r);
          const minC = Math.min(range.start.c, range.end.c);
          const maxC = Math.max(range.start.c, range.end.c);
          
          for(let r=minR; r<=maxR; r++) {
              for(let c=minC; c<=maxC; c++) {
                  const id = getCellId(r, c);
                  if(!newCells[id]) newCells[id] = { value: '' };
                  newCells[id] = { ...newCells[id], style: { ...newCells[id].style, ...style } };
                  changed = true;
              }
          }
      });

      if (changed) {
          setCells(newCells);
          saveToHistory();
      }
  };

  const handleFormatTable = () => {
      // Zebra Striping + Header
      if (selections.length === 0) return;
      const range = selections[0];
      const newCells = { ...cells };
      const minR = Math.min(range.start.r, range.end.r);
      const maxR = Math.max(range.start.r, range.end.r);
      const minC = Math.min(range.start.c, range.end.c);
      const maxC = Math.max(range.start.c, range.end.c);

      for(let r=minR; r<=maxR; r++) {
          const isHeader = r === minR;
          const isEven = (r - minR) % 2 === 0;
          for(let c=minC; c<=maxC; c++) {
              const id = getCellId(r, c);
              if(!newCells[id]) newCells[id] = { value: '' };
              if (isHeader) {
                  newCells[id].style = { ...newCells[id].style, bg: '#2563eb', color: '#fff', bold: true, align: 'center' };
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

  // --- CONTEXT ACTIONS ---
  const handleContextAction = (action: string) => {
      setContextMenu(null);
      if (selections.length === 0) return;
      
      const newCells = { ...cells };
      const range = selections[0];
      const minR = Math.min(range.start.r, range.end.r);
      const maxR = Math.max(range.start.r, range.end.r);
      const minC = Math.min(range.start.c, range.end.c);
      const maxC = Math.max(range.start.c, range.end.c);

      if (action === 'clear') {
          for(let r=minR; r<=maxR; r++) {
              for(let c=minC; c<=maxC; c++) delete newCells[getCellId(r, c)];
          }
          setCells(recalculateAll(newCells));
          saveToHistory();
      } else if (action === 'copy') {
          let text = '';
          for(let r=minR; r<=maxR; r++) {
              for(let c=minC; c<=maxC; c++) text += (newCells[getCellId(r, c)]?.value || '') + '\t';
              text += '\n';
          }
          navigator.clipboard.writeText(text);
          addToast({ type: 'success', title: 'Copiado', message: 'Células copiadas.' });
      } else if (action === 'delete_row') {
          // Simplificado: Apaga dados das linhas selecionadas
          for(let r=minR; r<=maxR; r++) {
              for(let c=0; c<DEFAULT_COLS; c++) delete newCells[getCellId(r, c)];
          }
          setCells(recalculateAll(newCells));
          saveToHistory();
      } else if (action === 'format_table') {
          handleFormatTable();
      }
  };

  // --- SYNC FORMULA BAR ---
  useEffect(() => {
      if (activeCell) {
          const id = getCellId(activeCell.r, activeCell.c);
          setFormulaInput(cells[id]?.value || '');
      } else {
          setFormulaInput('');
      }
  }, [activeCell, cells]);

  // --- SAVE ---
  const handleSave = async () => {
      setIsSaving(true);
      try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Planilha 1');
          
          Object.entries(cells).forEach(([key, rawCell]) => {
              const cell = rawCell as CellData; // Cast seguro para evitar erro 'unknown'
              const excelCell = sheet.getCell(key);
              
              const val = cell.value || '';
              if (val.startsWith('=')) {
                  excelCell.value = { formula: val.substring(1), result: cell.computed as any };
              } else {
                  excelCell.value = cell.computed as any;
              }
              
              if (cell.style) {
                  if (cell.style.bold) excelCell.font = { ...excelCell.font, bold: true };
                  if (cell.style.bg) excelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cell.style.bg.replace('#', '') } };
              }
          });
          
          const buffer = await workbook.xlsx.writeBuffer();
          const file = new File([buffer], `${filename}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Planilha salva no Drive.' });
          setWindowDirty(windowId, false);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] text-black select-none" onClick={() => setContextMenu(null)}>
        
        {/* HEADER */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-300 bg-white shrink-0">
             <div className="flex items-center gap-2">
                 <div className="p-1 bg-green-600 rounded text-white"><FileSpreadsheet className="w-4 h-4" /></div>
                 <Input value={filename} onChange={e => setFilename(e.target.value)} className="h-7 w-48 border-transparent hover:border-zinc-300 font-semibold bg-transparent px-2 focus:border-green-600" />
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

        {/* TOOLBAR */}
        <SheetToolbar onApplyFormat={applyFormat} onFormatTable={handleFormatTable} onClear={() => handleContextAction('clear')} />

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
                    if (activeCell) updateCell(activeCell.r, activeCell.c, e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && activeCell) {
                        updateCell(activeCell.r, activeCell.c, formulaInput, true);
                        if (activeCell.r < DEFAULT_ROWS - 1) {
                            setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
                            setSelections([{ start: { r: activeCell.r + 1, c: activeCell.c }, end: { r: activeCell.r + 1, c: activeCell.c } }]);
                        }
                    }
                }}
                onBlur={() => activeCell && updateCell(activeCell.r, activeCell.c, formulaInput, true)}
            />
        </div>

        {/* GRID */}
        <div className="flex-1 overflow-auto relative custom-scrollbar bg-zinc-200" ref={gridRef}>
            <SheetGrid 
                cells={cells}
                colWidths={colWidths}
                rowHeights={rowHeights}
                selections={selections}
                activeCell={activeCell}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onResizeStart={handleResizeStart}
                onFillHandleDown={handleFillHandleDown}
                onHeaderClick={(index, type) => {
                    if (index === -1) setSelections([{ start: { r: 0, c: 0 }, end: { r: DEFAULT_ROWS - 1, c: DEFAULT_COLS - 1 } }]);
                    else if (type === 'col') setSelections([{ start: { r: 0, c: index }, end: { r: DEFAULT_ROWS - 1, c: index } }]);
                    else setSelections([{ start: { r: index, c: 0 }, end: { r: index, c: DEFAULT_COLS - 1 } }]);
                }}
                onContextMenu={(e, r, c) => {
                    e.preventDefault();
                    if (!selections.some(s => r >= Math.min(s.start.r, s.end.r) && r <= Math.max(s.start.r, s.end.r) && c >= Math.min(s.start.c, s.end.c) && c <= Math.max(s.start.c, s.end.c))) {
                         setActiveCell({ r, c });
                         setSelections([{ start: { r, c }, end: { r, c } }]);
                    }
                    setContextMenu({ x: e.clientX, y: e.clientY, r, c });
                }}
            />
        </div>

        {/* CONTEXT MENU */}
        {contextMenu && (
            <SheetContextMenu 
                x={contextMenu.x} 
                y={contextMenu.y} 
                onClose={() => setContextMenu(null)}
                onAction={handleContextAction}
            />
        )}

        {/* STATUS BAR */}
        <div className="h-6 bg-zinc-100 border-t border-zinc-300 flex items-center px-3 justify-between text-[10px] text-zinc-500 shrink-0">
             <div>Pronto</div>
             {selections.length > 0 && (
                 <div className="flex gap-4 font-mono font-bold text-zinc-600">
                     <span>Média: {evaluateFormula(`AVG(${getCellId(selections[0].start.r, selections[0].start.c)}:${getCellId(selections[0].end.r, selections[0].end.c)})`, cells)}</span>
                     <span>Soma: {evaluateFormula(`SUM(${getCellId(selections[0].start.r, selections[0].start.c)}:${getCellId(selections[0].end.r, selections[0].end.c)})`, cells)}</span>
                 </div>
             )}
        </div>
    </div>
  );
}
