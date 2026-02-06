
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, FileSpreadsheet, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Plus, Trash, ArrowDown, ArrowRight, Loader2, Grid } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import ExcelJS from 'exceljs';

// Configuration
const DEFAULT_COLS = 26; // A-Z
const DEFAULT_ROWS = 100;
const CELL_WIDTH = 100;
const CELL_HEIGHT = 24;

interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    bg?: string;
    color?: string;
}

interface CellData {
    value: string;
    computed?: string;
    style?: CellStyle;
}

interface SheetState {
    cells: Record<string, CellData>;
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
}

export function SheetApp({ windowId }: { windowId: string }) {
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  // Core State
  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Nova Planilha'));
  const [cells, setCells] = useState<Record<string, CellData>>(initialState.cells || {});
  const [colWidths, setColWidths] = useState<Record<number, number>>(initialState.colWidths || {});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>(initialState.rowHeights || {});
  
  // History (Undo/Redo)
  const [history, setHistory] = useState<SheetState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Selection State
  const [selection, setSelection] = useState<{start: {r: number, c: number}, end: {r: number, c: number}} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeCell, setActiveCell] = useState<{r: number, c: number} | null>(null);
  const [isDraggingFill, setIsDraggingFill] = useState(false); // Para auto-fill

  // UI State
  const [formulaInput, setFormulaInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);
  
  // Refs for Dragging
  const gridRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef<{type: 'col' | 'row', index: number, start: number, startSize: number} | null>(null);

  // --- HELPERS ---
  const getColName = (index: number) => String.fromCharCode(65 + index); // 0 -> A
  const getCellId = (r: number, c: number) => `${getColName(c)}${r + 1}`;
  
  const saveToHistory = useCallback(() => {
      const newState = { cells, colWidths, rowHeights };
      // Remove futuros redos se houver
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newState))); // Deep copy
      
      // Limita histórico a 50 passos
      if (newHistory.length > 50) newHistory.shift();
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  }, [cells, colWidths, rowHeights, history, historyIndex]);

  const undo = () => {
      if (historyIndex > 0) {
          const prevState = history[historyIndex - 1];
          setCells(prevState.cells);
          setColWidths(prevState.colWidths);
          setRowHeights(prevState.rowHeights);
          setHistoryIndex(historyIndex - 1);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          setCells(nextState.cells);
          setColWidths(nextState.colWidths);
          setRowHeights(nextState.rowHeights);
          setHistoryIndex(historyIndex + 1);
      }
  };

  // Inicializa Histórico
  useEffect(() => {
      if (history.length === 0) {
          saveToHistory();
      }
  }, []);

  const evaluateFormula = (value: string) => {
      if (!value.startsWith('=')) return value;
      try {
          let expr = value.substring(1).toUpperCase();
          // Regex para referências de célula (Ex: A1, Z99)
          expr = expr.replace(/([A-Z]+)([0-9]+)/g, (match, colStr, rowStr) => {
              // Converte A -> 0, B -> 1
              // Simplificado: Assume uma letra
              // Na prática, deveria usar uma função de conversão robusta
              const id = match;
              const val = cells[id]?.value || '0';
              return isNaN(Number(val)) ? `"${val}"` : val;
          });
          
          // Funções Básicas
          expr = expr.replace(/SUM\((.*?)\)/g, (_, args) => {
             // Tratamento simples: SUM(1,2,3)
             // Um parser real (como hot-formula-parser) seria necessário para ranges (A1:A5)
             return args.split(',').reduce((acc: number, v: string) => acc + Number(v), 0);
          });
          
          // Eval Seguro (Relativo)
          // eslint-disable-next-line no-new-func
          return new Function(`return ${expr}`)();
      } catch (e) {
          return '#ERROR';
      }
  };

  // --- EFFECT: Sync Formula Bar ---
  useEffect(() => {
      if (activeCell) {
          const id = getCellId(activeCell.r, activeCell.c);
          setFormulaInput(cells[id]?.value || '');
      } else {
          setFormulaInput('');
      }
  }, [activeCell, cells]);

  // --- EFFECT: Persist State ---
  useEffect(() => {
      const timer = setTimeout(() => {
          setWindowState(windowId, { filename, cells, colWidths, rowHeights });
          setWindowDirty(windowId, Object.keys(cells).length > 0);
      }, 1000);
      return () => clearTimeout(timer);
  }, [filename, cells, colWidths, rowHeights, windowId]);

  // --- ACTIONS ---

  const handleCellChange = (r: number, c: number, value: string) => {
      const id = getCellId(r, c);
      setCells(prev => {
          const next = { ...prev };
          next[id] = { ...next[id], value, computed: evaluateFormula(value) };
          return next;
      });
  };

  // Commit change to history on blur/enter
  const commitChange = () => {
      saveToHistory();
  };

  const handleStyle = (key: keyof CellStyle, value: any) => {
      if (!selection) return;
      const { start, end } = selection;
      const minR = Math.min(start.r, end.r);
      const maxR = Math.max(start.r, end.r);
      const minC = Math.min(start.c, end.c);
      const maxC = Math.max(start.c, end.c);

      setCells(prev => {
          const next = { ...prev };
          for (let r = minR; r <= maxR; r++) {
              for (let c = minC; c <= maxC; c++) {
                  const id = getCellId(r, c);
                  next[id] = { 
                      ...next[id], 
                      style: { ...next[id]?.style, [key]: value } 
                  };
              }
          }
          return next;
      });
      saveToHistory();
  };

  // --- CONTEXT MENU ACTIONS ---
  const insertRow = (rowIndex: number) => {
      setCells(prev => {
          const next = { ...prev };
          // Move todas as células abaixo para baixo
          for (let r = DEFAULT_ROWS - 1; r >= rowIndex; r--) {
              for (let c = 0; c < DEFAULT_COLS; c++) {
                  const oldId = getCellId(r, c);
                  const newId = getCellId(r + 1, c);
                  if (next[oldId]) {
                      next[newId] = next[oldId];
                      delete next[oldId];
                  }
              }
          }
          return next;
      });
      setContextMenu(null);
      saveToHistory();
  };

  const deleteRow = (rowIndex: number) => {
      setCells(prev => {
          const next = { ...prev };
          // Remove a linha atual
          for (let c = 0; c < DEFAULT_COLS; c++) {
              delete next[getCellId(rowIndex, c)];
          }
          // Move as de baixo para cima
          for (let r = rowIndex + 1; r < DEFAULT_ROWS; r++) {
              for (let c = 0; c < DEFAULT_COLS; c++) {
                  const oldId = getCellId(r, c);
                  const newId = getCellId(r - 1, c);
                  if (next[oldId]) {
                      next[newId] = next[oldId];
                      delete next[oldId];
                  }
              }
          }
          return next;
      });
      setContextMenu(null);
      saveToHistory();
  };

  // --- MOUSE HANDLERS (Selection & Fill) ---

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
      if (e.button === 2) { // Right Click
           e.preventDefault();
           setContextMenu({ x: e.clientX, y: e.clientY, r, c });
           return;
      }

      setContextMenu(null);

      // Check if clicking fill handle
      // Simplificação: Se clicar muito perto do canto, ativa fill. 
      // Idealmente seria um elemento DOM separado, mas vamos usar estado.
      
      setIsSelecting(true);
      
      if (e.shiftKey && activeCell) {
          setSelection({ start: activeCell, end: { r, c } });
      } else {
          setActiveCell({ r, c });
          setSelection({ start: { r, c }, end: { r, c } });
      }
  };

  const handleFillHandleDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingFill(true);
      setIsSelecting(true); // Reutiliza lógica de seleção para visualização
  };

  const handleMouseEnter = (r: number, c: number) => {
      if (isSelecting && selection) {
          setSelection(prev => prev ? ({ ...prev, end: { r, c } }) : null);
      }
  };

  const handleMouseUp = () => {
      if (isDraggingFill && selection && activeCell) {
          // Lógica de Auto-Fill (Copiar valor da célula ativa para seleção)
          const { start, end } = selection;
          const minR = Math.min(start.r, end.r);
          const maxR = Math.max(start.r, end.r);
          const minC = Math.min(start.c, end.c);
          const maxC = Math.max(start.c, end.c);
          
          const sourceId = getCellId(activeCell.r, activeCell.c);
          const sourceData = cells[sourceId];

          if (sourceData) {
              setCells(prev => {
                  const next = { ...prev };
                  for (let r = minR; r <= maxR; r++) {
                      for (let c = minC; c <= maxC; c++) {
                          const targetId = getCellId(r, c);
                          if (targetId !== sourceId) {
                              next[targetId] = { ...sourceData }; // Copia valor e estilo
                          }
                      }
                  }
                  return next;
              });
              saveToHistory();
          }
      }

      setIsSelecting(false);
      setIsDraggingFill(false);
      isResizingRef.current = null;
  };

  // --- MOUSE HANDLERS (Resizing) ---

  const startResize = (e: React.MouseEvent, type: 'col' | 'row', index: number) => {
      e.stopPropagation();
      e.preventDefault();
      const startSize = type === 'col' ? (colWidths[index] || CELL_WIDTH) : (rowHeights[index] || CELL_HEIGHT);
      isResizingRef.current = { 
          type, 
          index, 
          start: type === 'col' ? e.clientX : e.clientY, 
          startSize 
      };
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const { type, index, start, startSize } = isResizingRef.current;
      const delta = (type === 'col' ? e.clientX : e.clientY) - start;
      const newSize = Math.max(20, startSize + delta);
      
      if (type === 'col') {
          setColWidths(prev => ({ ...prev, [index]: newSize }));
      } else {
          setRowHeights(prev => ({ ...prev, [index]: newSize }));
      }
  }, []);

  useEffect(() => {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
  }, [handleGlobalMouseMove, isDraggingFill, selection]); // Dependências importantes para o closure

  // --- SAVING ---
  const handleSave = async () => {
      setIsSaving(true);
      try {
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Sheet1');

          // Columns Widths
          const cols = [];
          for(let i=0; i<DEFAULT_COLS; i++) {
              if(colWidths[i]) cols.push({ width: colWidths[i] / 7 }); // Pixel to Excel Approx
          }
          if(cols.length) worksheet.columns = cols;

          // Cells
          Object.entries(cells).forEach(([key, rawData]) => {
              const data = rawData as CellData;
              const cell = worksheet.getCell(key);
              cell.value = isNaN(Number(data.value)) ? data.value : Number(data.value);
              if (data.style) {
                  if (data.style.bold) cell.font = { ...cell.font, bold: true };
                  if (data.style.italic) cell.font = { ...cell.font, italic: true };
                  if (data.style.color) cell.font = { ...cell.font, color: { argb: data.style.color.replace('#', '') } };
                  if (data.style.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.style.bg.replace('#', '') } };
                  if (data.style.align) cell.alignment = { horizontal: data.style.align };
              }
          });

          const buffer = await workbook.xlsx.writeBuffer();
          const file = new File([buffer], filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          await uploadFile(file);
          
          addToast({ type: 'success', title: 'Salvo', message: 'Planilha salva no Drive.' });
          setWindowDirty(windowId, false);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  // --- RENDER HELPERS ---
  const isCellSelected = (r: number, c: number) => {
      if (!selection) return false;
      const { start, end } = selection;
      const minR = Math.min(start.r, end.r);
      const maxR = Math.max(start.r, end.r);
      const minC = Math.min(start.c, end.c);
      const maxC = Math.max(start.c, end.c);
      return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  const isCellActive = (r: number, c: number) => activeCell?.r === r && activeCell?.c === c;

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] text-black select-none" onClick={() => setContextMenu(null)}>
        
        {/* TOP BAR */}
        <div className="flex flex-col border-b border-zinc-300 bg-white shrink-0">
            {/* Title & Save */}
            <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-green-600 rounded text-white"><FileSpreadsheet className="w-4 h-4" /></div>
                    <Input 
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className="h-7 w-48 border-transparent hover:border-zinc-300 focus:border-green-500 font-semibold bg-transparent px-2"
                    />
                </div>
                <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo} disabled={historyIndex <= 0} title="Desfazer"><Undo2 className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo} disabled={historyIndex >= history.length - 1} title="Refazer"><Redo2 className="w-4 h-4" /></Button>
                    <div className="w-px h-5 bg-zinc-300 mx-1" />
                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-2">
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                    </Button>
                </div>
            </div>

            {/* Toolbar Actions */}
            <div className="h-10 bg-zinc-100 flex items-center px-3 gap-2 border-b border-zinc-300 overflow-x-auto">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('bold', !cells[getCellId(activeCell?.r||0, activeCell?.c||0)]?.style?.bold)}><Bold className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('italic', !cells[getCellId(activeCell?.r||0, activeCell?.c||0)]?.style?.italic)}><Italic className="w-4 h-4" /></Button>
                <div className="w-px h-5 bg-zinc-300 mx-1" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'left')}><AlignLeft className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'center')}><AlignCenter className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'right')}><AlignRight className="w-4 h-4" /></Button>
                <div className="w-px h-5 bg-zinc-300 mx-1" />
                <div className="flex items-center gap-1" title="Cor do Texto">
                    <span className="text-xs font-bold text-zinc-500">A</span>
                    <input type="color" className="w-5 h-5 p-0 border-0 cursor-pointer rounded" onChange={(e) => handleStyle('color', e.target.value)} />
                </div>
                <div className="flex items-center gap-1" title="Cor de Fundo">
                    <span className="text-xs font-bold text-zinc-500 bg-zinc-200 px-1 rounded">Bg</span>
                    <input type="color" className="w-5 h-5 p-0 border-0 cursor-pointer rounded" onChange={(e) => handleStyle('bg', e.target.value)} defaultValue="#ffffff" />
                </div>
            </div>

            {/* Formula Bar */}
            <div className="flex items-center px-2 py-1 gap-2 bg-white border-b border-zinc-300">
                <div className="w-10 text-center text-xs font-bold text-zinc-500 bg-zinc-100 rounded border border-zinc-200 py-0.5">
                    {activeCell ? getCellId(activeCell.r, activeCell.c) : ''}
                </div>
                <div className="text-zinc-400 font-serif italic text-sm">fx</div>
                <input 
                    className="flex-1 h-6 text-sm outline-none border-l border-zinc-300 pl-2 focus:bg-blue-50 transition-colors"
                    value={formulaInput}
                    onChange={(e) => {
                        setFormulaInput(e.target.value);
                        if (activeCell) handleCellChange(activeCell.r, activeCell.c, e.target.value);
                    }}
                    onBlur={commitChange}
                    onKeyDown={(e) => {
                         if(e.key === 'Enter' && activeCell && activeCell.r < DEFAULT_ROWS - 1) {
                             setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
                             setSelection({ start: { r: activeCell.r + 1, c: activeCell.c }, end: { r: activeCell.r + 1, c: activeCell.c } });
                             commitChange();
                         }
                    }}
                />
            </div>
        </div>

        {/* GRID */}
        <div className="flex-1 overflow-auto relative custom-scrollbar bg-zinc-200" ref={gridRef}>
            <div className="relative bg-white" style={{ width: 'max-content' }}>
                
                {/* Header Row (A, B, C...) */}
                <div className="flex sticky top-0 z-20 shadow-sm">
                    <div className="w-[40px] bg-zinc-100 border-r border-b border-zinc-300 shrink-0 sticky left-0 z-30 flex items-center justify-center text-zinc-400 font-bold text-[10px]">
                        <Grid className="w-3 h-3" />
                    </div>
                    {Array.from({ length: DEFAULT_COLS }).map((_, c) => (
                        <div 
                            key={c} 
                            className={cn(
                                "h-[24px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 relative group select-none transition-colors",
                                selection && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c) && "bg-green-100 text-green-700 border-b-green-500"
                            )}
                            style={{ width: colWidths[c] || CELL_WIDTH }}
                        >
                            {getColName(c)}
                            {/* Resize Handle */}
                            <div 
                                className="absolute right-0 top-0 w-[4px] h-full cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 z-10"
                                onMouseDown={(e) => startResize(e, 'col', c)}
                            />
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {Array.from({ length: DEFAULT_ROWS }).map((_, r) => (
                    <div key={r} className="flex" style={{ height: rowHeights[r] || CELL_HEIGHT }}>
                        {/* Row Index (1, 2, 3...) */}
                        <div 
                            className={cn(
                                "w-[40px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-600 sticky left-0 z-10 relative group select-none transition-colors",
                                selection && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "bg-green-100 text-green-700 border-r-green-500"
                            )}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, r, c: -1 }); // c=-1 indica linha inteira
                            }}
                        >
                            {r + 1}
                            <div 
                                className="absolute bottom-0 left-0 w-full h-[4px] cursor-row-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 z-10"
                                onMouseDown={(e) => startResize(e, 'row', r)}
                            />
                        </div>

                        {/* Cells */}
                        {Array.from({ length: DEFAULT_COLS }).map((_, c) => {
                            const id = getCellId(r, c);
                            const cell = cells[id];
                            const selected = isCellSelected(r, c);
                            const active = isCellActive(r, c);
                            
                            return (
                                <div
                                    key={id}
                                    className={cn(
                                        "border-r border-b border-zinc-200 text-xs px-1 outline-none truncate relative cursor-cell",
                                        selected && "bg-blue-50",
                                        active && "bg-white ring-2 ring-blue-600 z-10",
                                        // Selection Borders
                                        selection && r === Math.min(selection.start.r, selection.end.r) && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c) && "border-t-blue-500",
                                        selection && c === Math.min(selection.start.c, selection.end.c) && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "border-l-blue-500",
                                        selection && c === Math.max(selection.start.c, selection.end.c) && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "border-r-blue-500",
                                        selection && r === Math.max(selection.start.r, selection.end.r) && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c) && "border-b-blue-500"
                                    )}
                                    style={{ 
                                        width: colWidths[c] || CELL_WIDTH,
                                        fontWeight: cell?.style?.bold ? 'bold' : 'normal',
                                        fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                                        textAlign: cell?.style?.align || 'left',
                                        backgroundColor: selected && !cell?.style?.bg ? undefined : cell?.style?.bg,
                                        color: cell?.style?.color
                                    }}
                                    onMouseDown={(e) => handleMouseDown(r, c, e)}
                                    onMouseEnter={() => handleMouseEnter(r, c)}
                                >
                                    {active ? (
                                        <input 
                                            className="w-full h-full bg-transparent outline-none"
                                            value={formulaInput}
                                            onChange={(e) => {
                                                setFormulaInput(e.target.value);
                                                handleCellChange(r, c, e.target.value);
                                            }}
                                            onBlur={commitChange}
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center overflow-hidden pointer-events-none">
                                            {cell?.computed || cell?.value || ''}
                                        </div>
                                    )}
                                    
                                    {/* FILL HANDLE (Pequeno quadrado no canto) */}
                                    {active && selection && r === Math.max(selection.start.r, selection.end.r) && c === Math.max(selection.start.c, selection.end.c) && (
                                        <div 
                                            className="absolute bottom-[-4px] right-[-4px] w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair z-20 hover:scale-125 transition-transform" 
                                            onMouseDown={handleFillHandleDown}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>

        {/* CONTEXT MENU */}
        {contextMenu && (
            <div 
                className="fixed bg-white border border-zinc-200 shadow-xl rounded-lg py-1 z-50 min-w-[160px] animate-in fade-in zoom-in-95"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {contextMenu.r !== -1 && (
                    <>
                        <button onClick={() => insertRow(contextMenu.r)} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-100 flex items-center gap-2">
                            <ArrowDown className="w-3 h-3 text-zinc-500" /> Inserir Linha Abaixo
                        </button>
                        <button onClick={() => deleteRow(contextMenu.r)} className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2">
                            <Trash className="w-3 h-3" /> Excluir Linha
                        </button>
                    </>
                )}
            </div>
        )}
    </div>
  );
}
