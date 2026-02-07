
'use client';

import React, { useState } from 'react';
import { 
    Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Type, Minus, Plus, 
    Printer, Download, FileText, Settings, Layout, ZoomIn, ZoomOut, Monitor, Undo2, Redo2,
    Highlighter, ChevronDown, Table as TableIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type EditorTab = 'home' | 'insert' | 'layout' | 'view';

interface EditorToolbarProps {
    activeTab: EditorTab;
    setActiveTab: (tab: EditorTab) => void;
    zoom: number;
    onZoomChange: (val: number) => void;
    viewMode: 'page' | 'web';
    setViewMode: (mode: 'page' | 'web') => void;
    onPrint: () => void;
    onSave: () => void;
    isSaving: boolean;
}

export function EditorToolbar({ 
    activeTab, setActiveTab, zoom, onZoomChange, 
    viewMode, setViewMode, onPrint, onSave, isSaving 
}: EditorToolbarProps) {

    return (
        <div className="flex flex-col border-b border-zinc-300 bg-[#fbfbfb] select-none shrink-0">
            {/* Tabs */}
            <div className="flex px-2 pt-1 border-b border-zinc-200 gap-1 bg-white">
                <button onClick={onSave} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-t-md hover:bg-blue-700 font-medium transition-colors flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Arquivo
                </button>
                {['home', 'insert', 'view'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as EditorTab)}
                        className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-t-md transition-all capitalize",
                            activeTab === tab 
                                ? "bg-[#fbfbfb] text-zinc-900 border-x border-t border-zinc-200 border-b-[#fbfbfb] -mb-[1px] z-10" 
                                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                        )}
                    >
                        {tab === 'home' ? 'Início' : tab === 'insert' ? 'Inserir' : 'Exibir'}
                    </button>
                ))}
            </div>

            {/* Ribbon Content - ID "toolbar" is required for Quill */}
            <div id="toolbar" className="h-24 px-4 py-2 flex items-start gap-4 overflow-x-auto">
                
                {/* --- HOME TAB --- */}
                <div className={cn("flex gap-4 h-full", activeTab === 'home' ? "flex" : "hidden")}>
                    
                    {/* Clipboard / History */}
                    <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <div className="flex gap-1">
                            <button className="ql-undo p-1.5 rounded hover:bg-zinc-200 text-zinc-600" title="Desfazer">
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button className="ql-redo p-1.5 rounded hover:bg-zinc-200 text-zinc-600" title="Refazer">
                                <Redo2 className="w-4 h-4" />
                            </button>
                        </div>
                        <span className="text-[10px] text-zinc-400">Histórico</span>
                    </div>

                    {/* Font & Format */}
                    <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <select className="ql-font w-32 h-7 text-xs border border-zinc-300 rounded px-1 bg-white outline-none">
                                    <option value="sans-serif" selected>Sans Serif</option>
                                    <option value="serif">Serif</option>
                                    <option value="monospace">Monospace</option>
                                </select>
                                <select className="ql-size w-16 h-7 text-xs border border-zinc-300 rounded px-1 bg-white outline-none">
                                    <option value="small">Pequeno</option>
                                    <option selected>Normal</option>
                                    <option value="large">Grande</option>
                                    <option value="huge">Título</option>
                                </select>
                            </div>
                            <div className="flex gap-0.5 bg-zinc-100 rounded p-0.5 border border-zinc-200">
                                <button className="ql-bold p-1 rounded hover:bg-white hover:shadow-sm transition-all"><Bold className="w-4 h-4" /></button>
                                <button className="ql-italic p-1 rounded hover:bg-white hover:shadow-sm transition-all"><Italic className="w-4 h-4" /></button>
                                <button className="ql-underline p-1 rounded hover:bg-white hover:shadow-sm transition-all"><Underline className="w-4 h-4" /></button>
                                <button className="ql-strike p-1 rounded hover:bg-white hover:shadow-sm transition-all"><Strikethrough className="w-4 h-4" /></button>
                                <div className="w-px bg-zinc-300 mx-1"></div>
                                <select className="ql-color w-8 p-1 bg-transparent hover:bg-white rounded"></select>
                                <select className="ql-background w-8 p-1 bg-transparent hover:bg-white rounded"></select>
                            </div>
                        </div>
                        <span className="text-[10px] text-zinc-400">Fonte</span>
                    </div>

                    {/* Paragraph */}
                    <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                         <div className="flex flex-col gap-2">
                             <div className="flex gap-0.5">
                                <button className="ql-list" value="ordered"><ListOrdered className="w-4 h-4" /></button>
                                <button className="ql-list" value="bullet"><List className="w-4 h-4" /></button>
                                <button className="ql-indent" value="-1"><Minus className="w-4 h-4" /></button>
                                <button className="ql-indent" value="+1"><Plus className="w-4 h-4" /></button>
                             </div>
                             <div className="flex gap-0.5 justify-center">
                                <button className="ql-align" value=""><AlignLeft className="w-4 h-4" /></button>
                                <button className="ql-align" value="center"><AlignCenter className="w-4 h-4" /></button>
                                <button className="ql-align" value="right"><AlignRight className="w-4 h-4" /></button>
                                <button className="ql-align" value="justify"><AlignJustify className="w-4 h-4" /></button>
                             </div>
                         </div>
                         <span className="text-[10px] text-zinc-400">Parágrafo</span>
                    </div>
                </div>

                {/* --- INSERT TAB --- */}
                <div className={cn("flex gap-4 h-full", activeTab === 'insert' ? "flex" : "hidden")}>
                    <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <div className="flex gap-2">
                            <button className="ql-image flex flex-col items-center gap-1 p-2 hover:bg-zinc-100 rounded text-zinc-700">
                                <ImageIcon className="w-6 h-6 text-purple-500" />
                                <span className="text-[10px]">Imagem</span>
                            </button>
                            <button className="ql-link flex flex-col items-center gap-1 p-2 hover:bg-zinc-100 rounded text-zinc-700">
                                <LinkIcon className="w-6 h-6 text-blue-500" />
                                <span className="text-[10px]">Link</span>
                            </button>
                        </div>
                        <span className="text-[10px] text-zinc-400">Mídia</span>
                    </div>
                </div>

                {/* --- VIEW TAB --- */}
                <div className={cn("flex gap-4 h-full", activeTab === 'view' ? "flex" : "hidden")}>
                     <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <div className="flex gap-2 items-center h-full">
                            <button onClick={() => setViewMode('page')} className={cn("flex flex-col items-center gap-1 p-2 rounded", viewMode === 'page' ? "bg-blue-50 text-blue-600 border border-blue-100" : "hover:bg-zinc-100 text-zinc-600")}>
                                <Layout className="w-5 h-5" />
                                <span className="text-[10px]">Layout Impressão</span>
                            </button>
                            <button onClick={() => setViewMode('web')} className={cn("flex flex-col items-center gap-1 p-2 rounded", viewMode === 'web' ? "bg-blue-50 text-blue-600 border border-blue-100" : "hover:bg-zinc-100 text-zinc-600")}>
                                <Monitor className="w-5 h-5" />
                                <span className="text-[10px]">Layout Web</span>
                            </button>
                        </div>
                        <span className="text-[10px] text-zinc-400">Modo de Exibição</span>
                     </div>

                     <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <div className="flex items-center gap-2 h-full">
                            <Button size="icon" variant="ghost" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
                            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <Button size="icon" variant="ghost" onClick={() => onZoomChange(Math.min(2, zoom + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
                        </div>
                        <span className="text-[10px] text-zinc-400">Zoom</span>
                     </div>

                     <div className="flex flex-col items-center justify-between border-r border-zinc-200 pr-4 h-full py-1">
                        <button onClick={onPrint} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-100 rounded text-zinc-700">
                            <Printer className="w-6 h-6 text-zinc-600" />
                            <span className="text-[10px]">Imprimir</span>
                        </button>
                     </div>
                </div>

            </div>
        </div>
    );
}
