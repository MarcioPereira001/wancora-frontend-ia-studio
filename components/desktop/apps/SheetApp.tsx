'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, FileSpreadsheet, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCloudStore } from '@/store/useCloudStore';
import { useDesktopStore } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import ExcelJS from 'exceljs';

// Grid Simples (26 cols x 100 rows)
const COLS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const ROWS = Array.from({ length: 100 }, (_, i) => i + 1);

interface CellData {
    value: string;
    style?: {
        bold?: boolean;
        italic?: boolean;
        align?: 'left' | 'center' | 'right';
        bg?: string;
    }
}

export function SheetApp({ windowId }: { windowId: string }) {
  const { uploadFile } = useCloudStore();
  const { setWindowState, setWindowDirty, windows } = useDesktopStore();
  const { addToast } = useToast();
  
  const windowInstance = windows.find(w => w.id === windowId);
  const initialState = windowInstance?.internalState || {};
  const data = windowInstance?.data || {};

  const [filename, setFilename] = useState(initialState.filename || (data.title || 'Nova Planilha'));
  const [cells, setCells] = useState<Record<string, CellData>>(initialState.cells || {});
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formulaValue, setFormulaValue] = useState('');

  // Sincroniza valor da célula com barra de fórmula
  useEffect(() => {
      if (selectedCell) {
          setFormulaValue(cells[selectedCell]?.value || '');
      } else {
          setFormulaValue('');
      }
  }, [selectedCell, cells]);

  // Persistência local (Debounce)
  useEffect(() => {
      const timer = setTimeout(() => {
          setWindowState(windowId, { filename, cells });
          setWindowDirty(windowId, Object.keys(cells).length > 0);
      }, 1000);
      return () => clearTimeout(timer);
  }, [filename, cells, windowId]);

  const updateCell = (id: string, value: string) => {
      setCells(prev => ({
          ...prev,
          [id]: { ...prev[id], value }
      }));
  };

  const updateStyle = (styleKey: keyof CellData['style'], value: any) => {
      if (!selectedCell) return;
      setCells(prev => ({
          ...prev,
          [selectedCell]: { 
              ...prev[selectedCell], 
              style: { ...(prev[selectedCell]?.style || {}), [styleKey]: value } 
          }
      }));
  };

  const handleSaveXlsx = async () => {
      setIsSaving(true);
      try {
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Planilha 1');

          // Popula dados e estilos
          Object.entries(cells).forEach(([key, item]) => {
              const data = item as CellData;
              if(!data.value) return;
              const cell = worksheet.getCell(key);
              cell.value = isNaN(Number(data.value)) ? data.value : Number(data.value);
              
              if(data.style) {
                  if(data.style.bold) cell.font = { ...cell.font, bold: true };
                  if(data.style.italic) cell.font = { ...cell.font, italic: true };
                  if(data.style.align) cell.alignment = { horizontal: data.style.align };
                  if(data.style.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.style.bg.replace('#', '') } };
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

  const handleDownload = async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Planilha 1');
      Object.entries(cells).forEach(([key, item]) => {
          const data = item as CellData;
          if(data.value) worksheet.getCell(key).value = isNaN(Number(data.value)) ? data.value : Number(data.value);
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      a.click();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 text-black">
        {/* Toolbar */}
        <div className="h-28 bg-zinc-100 border-b border-zinc-300 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <Input 
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className="h-7 bg-transparent border-transparent hover:border-zinc-300 focus:border-green-500 font-bold text-zinc-800 w-48 text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 text-xs border-zinc-300 text-zinc-700 bg-white">
                        <Download className="w-3 h-3 mr-2" /> Baixar
                    </Button>
                    <Button size="sm" onClick={handleSaveXlsx} disabled={isSaving} className="h-7 text-xs bg-green-600 hover:bg-green-500 text-white">
                        <Save className="w-3 h-3 mr-2" /> {isSaving ? 'Salvando...' : 'Salvar no Drive'}
                    </Button>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-50 border-b border-zinc-200">
                <Button size="icon" variant="ghost" className={cn("h-7 w-7", cells[selectedCell!]?.style?.bold && "bg-zinc-200")} onClick={() => updateStyle('bold', !cells[selectedCell!]?.style?.bold)}><Bold className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className={cn("h-7 w-7", cells[selectedCell!]?.style?.italic && "bg-zinc-200")} onClick={() => updateStyle('italic', !cells[selectedCell!]?.style?.italic)}><Italic className="w-3 h-3" /></Button>
                <div className="w-px h-4 bg-zinc-300 mx-1" />
                <Button size="icon" variant="ghost" className={cn("h-7 w-7", cells[selectedCell!]?.style?.align === 'left' && "bg-zinc-200")} onClick={() => updateStyle('align', 'left')}><AlignLeft className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className={cn("h-7 w-7", cells[selectedCell!]?.style?.align === 'center' && "bg-zinc-200")} onClick={() => updateStyle('align', 'center')}><AlignCenter className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className={cn("h-7 w-7", cells[selectedCell!]?.style?.align === 'right' && "bg-zinc-200")} onClick={() => updateStyle('align', 'right')}><AlignRight className="w-3 h-3" /></Button>
                <div className="w-px h-4 bg-zinc-300 mx-1" />
                <input type="color" className="w-6 h-6 border-0 p-0 cursor-pointer" onChange={(e) => updateStyle('bg', e.target.value)} title="Cor de fundo" />
                <div className="w-px h-4 bg-zinc-300 mx-1" />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => updateCell(selectedCell!, '')}><Trash2 className="w-3 h-3" /></Button>
            </div>

            {/* Formula Bar */}
            <div className="flex items-center gap-2 px-2 py-1 bg-white">
                <div className="text-xs font-bold text-zinc-400 w-8 text-center">{selectedCell || ''}</div>
                <div className="h-4 w-px bg-zinc-300" />
                <span className="text-zinc-400 font-serif italic text-sm">fx</span>
                <input 
                    className="flex-1 text-sm outline-none px-2 h-6 border-b border-transparent focus:border-green-500" 
                    value={formulaValue}
                    onChange={(e) => {
                        setFormulaValue(e.target.value);
                        if(selectedCell) updateCell(selectedCell, e.target.value);
                    }}
                    disabled={!selectedCell}
                />
            </div>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto relative custom-scrollbar bg-zinc-200">
            <div className="inline-block min-w-full bg-white shadow-sm">
                
                {/* Header Cols */}
                <div className="flex sticky top-0 z-10">
                    <div className="w-10 h-6 bg-zinc-100 border-r border-b border-zinc-300 shrink-0 select-none" />
                    {COLS.map(col => (
                        <div key={col} className="w-24 h-6 bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0 select-none">
                            {col}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {ROWS.map(row => (
                    <div key={row} className="flex">
                        {/* Header Row Index */}
                        <div className="w-10 h-6 bg-zinc-100 border-r border-b border-zinc-300 flex items-center justify-center text-xs text-zinc-500 shrink-0 select-none sticky left-0 z-10">
                            {row}
                        </div>
                        
                        {/* Cells */}
                        {COLS.map(col => {
                            const id = `${col}${row}`;
                            const data = cells[id] || {};
                            const isSelected = selectedCell === id;

                            return (
                                <input
                                    key={id}
                                    value={data.value || ''}
                                    onClick={() => setSelectedCell(id)}
                                    onChange={(e) => updateCell(id, e.target.value)}
                                    className={cn(
                                        "w-24 h-6 border-r border-b border-zinc-200 text-xs px-1 outline-none focus:ring-2 focus:ring-green-500 focus:z-20 truncate",
                                        data.style?.bold && "font-bold",
                                        data.style?.italic && "italic",
                                        data.style?.align === 'center' && "text-center",
                                        data.style?.align === 'right' && "text-right",
                                        isSelected && "bg-blue-50"
                                    )}
                                    style={{ backgroundColor: data.style?.bg }}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}