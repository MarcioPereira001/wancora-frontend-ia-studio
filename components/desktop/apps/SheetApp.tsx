'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, FileSpreadsheet, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2, Home, Grid, Database, Calculator, Loader2 } from 'lucide-react';
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
const HEADER_HEIGHT = 24;
const HEADER_WIDTH = 40;

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
  
  // Selection State
  const [selection, setSelection] = useState<{start: {r: number, c: number}, end: {r: number, c: number}} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeCell, setActiveCell] = useState<{r: number, c: number} | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'home' | 'data'>('home');
  const [formulaInput, setFormulaInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs for Dragging
  const gridRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef<{type: 'col' | 'row', index: number, start: number, startSize: number} | null>(null);

  // --- HELPERS ---
  const getColName = (index: number) => String.fromCharCode(65 + index); // 0 -> A
  const getCellId = (r: number, c: number) => `${getColName(c)}${r + 1}`;
  
  const evaluateFormula = (value: string) => {
      if (!value.startsWith('=')) return value;
      try {
          // Simplistic formula evaluator (Supports: =A1+B2, =SUM(A1,A2))
          // Security Warning: Using Function constructor is safer than eval but still has risks. 
          // For a robust app, use 'hot-formula-parser' or similar. 
          // Here we do simple replacements for demo purposes.
          
          let expr = value.substring(1).toUpperCase();
          
          // Replace cell references with values
          expr = expr.replace(/[A-Z]+[0-9]+/g, (match) => {
              const val = cells[match]?.value || '0';
              return isNaN(Number(val)) ? `"${val}"` : val;
          });
          
          // Basic Functions
          expr = expr.replace(/SUM\((.*?)\)/g, (_, args) => {
              return args.split(',').reduce((acc: number, v: string) => acc + Number(v), 0);
          });

          // Evaluate
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
  };

  // --- MOUSE HANDLERS (Selection) ---

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      setIsSelecting(true);
      
      if (e.shiftKey && activeCell) {
          // Range selection
          setSelection({ start: activeCell, end: { r, c } });
      } else if (e.ctrlKey || e.metaKey) {
          // TODO: Multi-range support (Complex, skipping for now, treating as new selection)
          setActiveCell({ r, c });
          setSelection({ start: { r, c }, end: { r, c } });
      } else {
          // New single selection
          setActiveCell({ r, c });
          setSelection({ start: { r, c }, end: { r, c } });
      }
  };

  const handleMouseEnter = (r: number, c: number) => {
      if (isSelecting && selection) {
          setSelection(prev => prev ? ({ ...prev, end: { r, c } }) : null);
      }
  };

  const handleMouseUp = () => {
      setIsSelecting(false);
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
  }, [handleGlobalMouseMove]);

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
          Object.entries(cells).forEach(([key, cellValue]) => {
              const data = cellValue as CellData;
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
    <div className="flex flex-col h-full bg-[#f8f9fa] text-black select-none">
        
        {/* TOP BAR (Ribbon Style) */}
        <div className="flex flex-col border-b border-zinc-300 bg-white">
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
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-2">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex px-2 pt-1 gap-1">
                <button onClick={() => setActiveTab('home')} className={cn("px-4 py-1 text-xs rounded-t-lg transition-colors border-b-2", activeTab === 'home' ? "bg-zinc-100 border-green-500 text-green-700 font-bold" : "text-zinc-500 border-transparent hover:bg-zinc-50")}>Início</button>
                <button onClick={() => setActiveTab('data')} className={cn("px-4 py-1 text-xs rounded-t-lg transition-colors border-b-2", activeTab === 'data' ? "bg-zinc-100 border-green-500 text-green-700 font-bold" : "text-zinc-500 border-transparent hover:bg-zinc-50")}>Dados</button>
            </div>

            {/* Toolbar Actions */}
            <div className="h-10 bg-zinc-100 flex items-center px-3 gap-2 border-b border-zinc-300">
                {activeTab === 'home' && (
                    <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('bold', !cells[getCellId(activeCell?.r||0, activeCell?.c||0)]?.style?.bold)}><Bold className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('italic', !cells[getCellId(activeCell?.r||0, activeCell?.c||0)]?.style?.italic)}><Italic className="w-4 h-4" /></Button>
                        <div className="w-px h-5 bg-zinc-300 mx-1" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'left')}><AlignLeft className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'center')}><AlignCenter className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStyle('align', 'right')}><AlignRight className="w-4 h-4" /></Button>
                        <div className="w-px h-5 bg-zinc-300 mx-1" />
                        <input type="color" className="w-6 h-6 p-0 border-0 cursor-pointer" onChange={(e) => handleStyle('color', e.target.value)} title="Cor do Texto" />
                        <input type="color" className="w-6 h-6 p-0 border-0 cursor-pointer" onChange={(e) => handleStyle('bg', e.target.value)} title="Cor de Fundo" defaultValue="#ffffff" />
                    </>
                )}
                {activeTab === 'data' && (
                    <div className="text-xs text-zinc-500">Ferramentas de dados em breve...</div>
                )}
            </div>

            {/* Formula Bar */}
            <div className="flex items-center px-2 py-1 gap-2 bg-white border-b border-zinc-300">
                <div className="w-8 text-center text-xs font-bold text-zinc-500 bg-zinc-100 rounded border border-zinc-200">
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
                    onKeyDown={(e) => {
                         if(e.key === 'Enter' && activeCell && activeCell.r < DEFAULT_ROWS - 1) {
                             setActiveCell({ r: activeCell.r + 1, c: activeCell.c });
                             setSelection({ start: { r: activeCell.r + 1, c: activeCell.c }, end: { r: activeCell.r + 1, c: activeCell.c } });
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
                    <div className="w-[40px] bg-zinc-100 border-r border-b border-zinc-300 shrink-0 sticky left-0 z-30" />
                    {Array.from({ length: DEFAULT_COLS }).map((_, c) => (
                        <div 
                            key={c} 
                            className={cn(
                                "h-[24px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 relative group select-none",
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
                                "w-[40px] bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-600 sticky left-0 z-10 relative group select-none",
                                selection && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "bg-green-100 text-green-700 border-r-green-500"
                            )}
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
                                        "border-r border-b border-zinc-200 text-xs px-1 outline-none truncate relative",
                                        selected && "bg-blue-50",
                                        active && "bg-white ring-2 ring-blue-600 z-10",
                                        // Top Borders for selection range
                                        selection && r === Math.min(selection.start.r, selection.end.r) && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c) && "border-t-blue-500",
                                        // Left Borders
                                        selection && c === Math.min(selection.start.c, selection.end.c) && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "border-l-blue-500",
                                        // Right Borders
                                        selection && c === Math.max(selection.start.c, selection.end.c) && r >= Math.min(selection.start.r, selection.end.r) && r <= Math.max(selection.start.r, selection.end.r) && "border-r-blue-500",
                                        // Bottom Borders
                                        selection && r === Math.max(selection.start.r, selection.end.r) && c >= Math.min(selection.start.c, selection.end.c) && c <= Math.max(selection.start.c, selection.end.c) && "border-b-blue-500"
                                    )}
                                    style={{ 
                                        width: colWidths[c] || CELL_WIDTH,
                                        fontWeight: cell?.style?.bold ? 'bold' : 'normal',
                                        fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                                        textAlign: cell?.style?.align || 'left',
                                        backgroundColor: selected ? undefined : cell?.style?.bg, // Selection overrides bg for visibility
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
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center overflow-hidden pointer-events-none">
                                            {cell?.computed || cell?.value || ''}
                                        </div>
                                    )}
                                    
                                    {/* Drag Handle for future Auto-Fill */}
                                    {active && selection && r === Math.max(selection.start.r, selection.end.r) && c === Math.max(selection.start.c, selection.end.c) && (
                                        <div className="absolute bottom-[-4px] right-[-4px] w-2 h-2 bg-blue-600 border border-white cursor-crosshair z-20" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}