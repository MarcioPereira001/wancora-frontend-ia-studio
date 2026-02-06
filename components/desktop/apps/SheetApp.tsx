
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, FileSpreadsheet, Loader2, Upload, ChevronDown, Cloud } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { useAuthStore } from '@/store/useAuthStore';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf'; 
import { api } from '@/services/api';

// Imports Modulares
import { SheetToolbar } from './sheet/SheetToolbar';
import { SheetGrid } from './sheet/SheetGrid';
import { SheetContextMenu } from './sheet/SheetContextMenu';
import { SheetSaveModal } from './sheet/SheetSaveModal';
import { ImportDriveModal } from './ImportDriveModal'; 
import { CellData, SheetState, SelectionRange, CellStyle } from './sheet/types';
import { DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_CELL_WIDTH, DEFAULT_CELL_HEIGHT, getCellId, evaluateFormula, getColName } from './sheet/utils';
import { cn } from '@/lib/utils';

export function SheetApp({ windowId }: { windowId: string }) {
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { user } = useAuthStore();
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
  const [editingCell, setEditingCell] = useState<{r: number, c: number} | null>(null);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- MODALS & MENUS ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isImportDriveOpen, setIsImportDriveOpen] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // Input file oculto para importação
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ type: 'col'|'row', index: number, start: number, startSize: number } | null>(null);

  // --- LOAD EXISTING FILE (EDIT MODE) ---
  useEffect(() => {
      const loadFile = async () => {
          if (!data.fileId || initialState.cells) return;
          
          setLoadingFile(true);
          try {
              if (user?.company_id) {
                  // Busca o conteúdo binário (XLSX) do backend
                  const res = await api.post('/cloud/google/download-content', {
                      companyId: user.company_id,
                      fileId: data.fileId
                  });

                  if (res.base64) {
                      const binaryString = atob(res.base64);
                      const len = binaryString.length;
                      const bytes = new Uint8Array(len);
                      for (let i = 0; i < len; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                      }
                      
                      const workbook = new ExcelJS.Workbook();
                      await workbook.xlsx.load(bytes.buffer);
                      const worksheet = workbook.getWorksheet(1);
                      
                      if (worksheet) {
                           const newCells: Record<string, CellData> = {};
                           worksheet.eachRow((row, rowNumber) => {
                               row.eachCell((cell, colNumber) => {
                                   const id = getCellId(rowNumber - 1, colNumber - 1);
                                   let val = cell.value;
                                   let computed: any = val;

                                   if (typeof val === 'object' && val !== null) {
                                       if ('formula' in val) {
                                           val = `=${val.formula}`;
                                           computed = val.result;
                                       } else if ('richText' in val) {
                                           val = val.richText.map((r: any) => r.text).join('');
                                           computed = val;
                                       }
                                   }
                                   newCells[id] = { value: String(val), computed: computed };
                               });
                           });
                           setCells(newCells);
                           setFilename(res.filename || filename);
                           // Save initial history
                           const state = { cells: newCells, colWidths: {}, rowHeights: {} };
                           setHistory([state]);
                           setHistoryIndex(0);
                      }
                      addToast({ type: 'success', title: 'Carregado', message: 'Planilha aberta.' });
                  }
              }
          } catch (e: any) {
              console.error(e);
              addToast({ type: 'error', title: 'Erro', message: 'Falha ao abrir planilha. ' + e.message });
          } finally {
              setLoadingFile(false);
          }
      };

      loadFile();
  }, [data.fileId]);


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

  // Init History if empty and not loading file
  useEffect(() => {
      if (history.length === 0 && !data.fileId) saveToHistory();
  }, []);

  // Menu Listener
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
            setShowImportMenu(false);
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // --- RECALCULATE ---
  const recalculateAll = (currentCells: Record<string, CellData>) => {
      const nextCells = { ...currentCells };
      Object.keys(nextCells).forEach(key => {
          const cell = nextCells[key];
          if(cell.value && cell.value.toString().startsWith('=')) {
              cell.computed = evaluateFormula(cell.value, nextCells);
          } else {
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
          setEditingCell(null); 
      } else {
          setCells(newCells);
      }
  };

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (editingCell) return; 

        if ((e.ctrlKey || e.metaKey)) {
            if (e.key === 'b') { e.preventDefault(); applyFormat({ bold: true }); return; }
            if (e.key === 'i') { e.preventDefault(); applyFormat({ italic: true }); return; }
            if (e.key === 'u') { e.preventDefault(); applyFormat({ underline: true }); return; }
            if (e.key === 'z') { e.preventDefault(); undo(); return; }
            if (e.key === 'y') { e.preventDefault(); redo(); return; }
            
            if (e.shiftKey) {
                if (e.key === '$') { e.preventDefault(); applyFormat({ format: 'currency' }); return; }
                if (e.key === '%') { e.preventDefault(); applyFormat({ format: 'percent' }); return; }
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selections, editingCell, cells, historyIndex]);

  // --- MOUSE HANDLERS (Selection) ---
  const handleMouseDown = (e: React.MouseEvent, r: number, c: number) => {
      if (editingCell) return;

      if (e.button === 2) { 
           e.preventDefault();
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
      setIsDragging(true);
  };

  const handleGlobalMouseUp = () => {
      if (isFillDragging && activeCell && selections.length > 0) {
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
                          newCells[targetId] = { ...sourceData }; 
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
  }, [isFillDragging, activeCell, selections]); 

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
                  
                  // Toggle logic for boolean styles
                  const currentStyle = newCells[id].style || {};
                  const nextStyle = { ...currentStyle, ...style };
                  
                  if (style.bold !== undefined && currentStyle.bold) nextStyle.bold = false;
                  if (style.italic !== undefined && currentStyle.italic) nextStyle.italic = false;
                  if (style.underline !== undefined && currentStyle.underline) nextStyle.underline = false;

                  newCells[id] = { ...newCells[id], style: nextStyle };
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
          for(let r=minR; r<=maxR; r++) {
              for(let c=0; c<DEFAULT_COLS; c++) delete newCells[getCellId(r, c)];
          }
          setCells(recalculateAll(newCells));
          saveToHistory();
      } else if (action === 'format_table') {
          handleFormatTable();
      }
  };

  // --- SAVE / EXPORT ---
  const generateXLSXBuffer = async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Planilha 1');
      
      // 1. Definição de Colunas e Larguras
      const columns = [];
      for(let i=0; i<DEFAULT_COLS; i++) {
          // ExcelJS width é aproximado por caractere. Default do grid é pixel.
          // Uma aproximação razoável é pixels / 7.
          const width = colWidths[i] ? Number(colWidths[i]) / 7 : DEFAULT_CELL_WIDTH / 7;
          columns.push({ header: '', key: getColName(i), width: width });
      }
      sheet.columns = columns;

      // 2. Altura das Linhas
      Object.entries(rowHeights).forEach(([rowIdx, height]) => {
          const row = sheet.getRow(Number(rowIdx) + 1);
          if (row) row.height = Number(height) * 0.75; // Conversão aproximada px -> points
      });

      // 3. Células e Estilos
      Object.entries(cells).forEach(([key, rawCell]) => {
          const cell = rawCell as CellData;
          const excelCell = sheet.getCell(key);
          const val = cell.value || '';
          
          // Valor e Fórmula
          if (val.startsWith('=')) {
              excelCell.value = { formula: val.substring(1), result: cell.computed as any };
          } else {
              excelCell.value = cell.computed as any;
          }

          // Estilos Completos (CORRIGIDO PARA SALVAR FORMATAÇÃO)
          if (cell.style) {
              const style = cell.style;
              
              // Fonte
              excelCell.font = {
                  name: 'Calibri',
                  bold: style.bold,
                  italic: style.italic,
                  underline: style.underline,
                  color: style.color ? { argb: style.color.replace('#', '') } : undefined,
                  size: style.fontSize || 11
              };

              // Preenchimento (Background)
              if (style.bg) {
                  excelCell.fill = {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: style.bg.replace('#', '') }
                  };
              }

              // Alinhamento
              if (style.align) {
                  excelCell.alignment = {
                      horizontal: style.align,
                      vertical: 'middle' // Padrão
                  };
              }

              // Formatação Numérica
              if (style.format) {
                  if (style.format === 'currency') excelCell.numFmt = '"R$"#,##0.00';
                  else if (style.format === 'percent') excelCell.numFmt = '0.00%';
                  else if (style.format === 'date') excelCell.numFmt = 'dd/mm/yyyy';
                  else if (style.format === 'number') excelCell.numFmt = '#,##0.00';
              }
          }
      });

      return await workbook.xlsx.writeBuffer();
  };

  const handleConfirmSave = async (target: 'drive' | 'local', format: 'xlsx' | 'csv' | 'pdf', newName: string) => {
      setFilename(newName);
      setIsSaveModalOpen(false);
      setIsSaving(true);
      
      try {
          if (format === 'xlsx') {
              const buffer = await generateXLSXBuffer();
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              
              if (target === 'local') {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${newName}.xlsx`;
                  a.click();
              } else {
                  const file = new File([blob], `${newName}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  await uploadFile(file);
                  setWindowDirty(windowId, false);
              }
          } 
          else if (format === 'csv') {
              const workbook = new ExcelJS.Workbook();
              const sheet = workbook.addWorksheet('Sheet1');
              Object.entries(cells).forEach(([key, d]) => { sheet.getCell(key).value = (d as CellData).computed as any; });
              const buffer = await workbook.csv.writeBuffer();
              const blob = new Blob([buffer], { type: 'text/csv' });
              
              if (target === 'local') {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${newName}.csv`;
                  a.click();
              } else {
                  const file = new File([blob], `${newName}.csv`, { type: 'text/csv' });
                  await uploadFile(file);
              }
          }
          else if (format === 'pdf') {
             const doc = new jsPDF();
             doc.text(newName, 10, 10);
             let y = 20;
             const sortedKeys = Object.keys(cells).sort(); 
             sortedKeys.forEach(key => {
                 const val = (cells[key] as CellData).computed;
                 if (val) {
                     doc.text(`${key}: ${val}`, 10, y);
                     y += 7;
                     if(y > 280) { doc.addPage(); y = 20; }
                 }
             });
             
             if (target === 'local') {
                 doc.save(`${newName}.pdf`);
             } else {
                 const blob = doc.output('blob');
                 const file = new File([blob], `${newName}.pdf`, { type: 'application/pdf' });
                 await uploadFile(file);
             }
          }

          if(target === 'drive') addToast({ type: 'success', title: 'Salvo', message: 'Arquivo salvo no Drive.' });

      } catch(e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const buffer = evt.target?.result as ArrayBuffer;
              const workbook = new ExcelJS.Workbook();
              await workbook.xlsx.load(buffer);
              const worksheet = workbook.getWorksheet(1);
              
              if (worksheet) {
                  const newCells: Record<string, CellData> = {};
                  worksheet.eachRow((row, rowNumber) => {
                      row.eachCell((cell, colNumber) => {
                          const id = getCellId(rowNumber - 1, colNumber - 1);
                          let val = cell.value;
                          let computed: any = val;

                          if (typeof val === 'object' && val !== null) {
                              if ('formula' in val) {
                                  val = `=${val.formula}`;
                                  computed = val.result;
                              } else if ('richText' in val) {
                                  val = val.richText.map((r:any) => r.text).join('');
                                  computed = val;
                              }
                          }
                          newCells[id] = { value: String(val), computed: computed };
                      });
                  });
                  setCells(newCells);
                  setFilename(file.name.replace('.xlsx', ''));
                  saveToHistory();
                  addToast({ type: 'success', title: 'Importado', message: 'Planilha carregada.' });
              }
          } catch (error) {
              addToast({ type: 'error', title: 'Erro', message: 'Falha ao ler arquivo XLSX.' });
          }
      };
      reader.readAsArrayBuffer(file);
      if(fileInputRef.current) fileInputRef.current.value = '';
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

  if (loadingFile) {
      return <div className="flex h-full items-center justify-center bg-white text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] text-black select-none" onClick={() => setContextMenu(null)}>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleImportFile} />

        {/* HEADER: BOTÕES SALVAR/IMPORTAR MOVIDOS PARA CÁ */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-300 bg-white shrink-0">
             <div className="flex items-center gap-2">
                 <div className="p-1 bg-green-600 rounded text-white"><FileSpreadsheet className="w-4 h-4" /></div>
                 <Input 
                    value={filename} 
                    onChange={e => setFilename(e.target.value)} 
                    className="h-7 w-48 border-transparent hover:border-zinc-300 font-bold text-black bg-transparent px-2 focus:border-green-600 focus:bg-white" 
                 />
             </div>
             
             {/* ACTIONS: Import & Save */}
             <div className="flex gap-2">
                 {/* Menu Importar */}
                 <div className="relative" ref={importMenuRef}>
                    <Button 
                        size="sm" 
                        variant="ghost"
                        className={cn("h-7 gap-1 font-bold text-zinc-600 bg-zinc-100 border border-zinc-200", showImportMenu ? "bg-zinc-200" : "")}
                        onClick={() => setShowImportMenu(!showImportMenu)}
                    >
                        <Upload className="w-3.5 h-3.5 text-orange-500" /> Importar <ChevronDown className="w-3 h-3" />
                    </Button>
                    {showImportMenu && (
                        <div className="absolute top-8 right-0 bg-white border border-zinc-200 shadow-xl rounded-lg w-48 py-1 z-50 animate-in fade-in zoom-in-95">
                            <button onClick={() => { setIsImportDriveOpen(true); setShowImportMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2">
                                <Cloud className="w-4 h-4 text-blue-500" /> Do Google Drive
                            </button>
                            <label className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 flex items-center gap-2 cursor-pointer">
                                <Upload className="w-4 h-4 text-zinc-500" /> Do Computador
                                <input type="file" className="hidden" accept=".xlsx" onChange={(e) => { handleImportFile(e); setShowImportMenu(false); }} />
                            </label>
                        </div>
                    )}
                 </div>

                 <Button 
                    size="sm" 
                    onClick={() => setIsSaveModalOpen(true)} 
                    className="bg-green-600 hover:bg-green-500 text-white gap-2 h-7 text-xs font-bold shadow-sm"
                 >
                    <Save className="w-3.5 h-3.5" /> Salvar
                 </Button>
             </div>
        </div>

        {/* TOOLBAR: UNDO/REDO AGORA AQUI */}
        <SheetToolbar 
            onApplyFormat={applyFormat} 
            onFormatTable={handleFormatTable} 
            onClear={() => handleContextAction('clear')}
            onUndo={undo}
            onRedo={redo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
        />

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
                editingCell={editingCell} 
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
                onDoubleClick={(r, c) => {
                    setActiveCell({ r, c });
                    setEditingCell({ r, c });
                }}
                onCellCommit={(r, c, val) => {
                    updateCell(r, c, val, true);
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

        {/* MODALS */}
        <SheetSaveModal 
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            currentFilename={filename}
            onConfirm={handleConfirmSave}
            isSaving={isSaving}
        />

        <ImportDriveModal 
            isOpen={isImportDriveOpen}
            onClose={() => setIsImportDriveOpen(false)}
            onImportSuccess={() => { /* Lógica de refresh se necessário */ }}
        />

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
