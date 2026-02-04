
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDesktopStore } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import { Zap, Cloud, FileText, Monitor, X, Minus, Save, Maximize2, Layout, FileSpreadsheet } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export function Taskbar() {
  const { windows, activeWindowId, focusWindow, toggleMinimize, closeWindow, openWindow, centerWindow } = useDesktopStore();
  const { user } = useAuthStore();
  const [time, setTime] = useState(new Date());
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{id: string, x: number, y: number} | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      const handleClick = (e: MouseEvent) => {
          if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
              setContextMenu(null);
          }
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleWindowClick = (id: string, isMinimized: boolean, isActive: boolean) => {
      if (isMinimized) {
          toggleMinimize(id); 
          focusWindow(id);    
      } else if (isActive) {
          toggleMinimize(id); 
      } else {
          focusWindow(id); 
      }
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setContextMenu({ id, x: e.clientX, y: e.clientY - 160 }); // Sobe um pouco mais
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'drive': return <Cloud className="w-4 h-4 text-green-400" />;
          case 'editor': return <FileText className="w-4 h-4 text-blue-400" />;
          case 'sheet': return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
          case 'preview': return <Monitor className="w-4 h-4 text-purple-400" />;
          default: return <Monitor className="w-4 h-4" />;
      }
  };

  return (
    <>
        {/* Start Menu */}
        {startMenuOpen && (
            <div className="absolute bottom-12 left-2 w-64 bg-[#0f0f11]/90 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-2xl p-2 z-[9999] animate-in slide-in-from-bottom-2">
                <div className="p-3 border-b border-zinc-800 mb-2 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                        {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full" /> : <span className="font-bold text-xs">{user?.name?.charAt(0)}</span>}
                     </div>
                     <div className="overflow-hidden">
                         <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                         <p className="text-[10px] text-zinc-500">Wancora OS v4.5</p>
                     </div>
                </div>
                <div className="space-y-1">
                    <button onClick={() => { openWindow('drive', 'Meu Drive'); setStartMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-2">
                        <Cloud className="w-4 h-4" /> Arquivos
                    </button>
                    <button onClick={() => { openWindow('editor', 'Novo Documento'); setStartMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Editor de Texto
                    </button>
                    <button onClick={() => { openWindow('sheet', 'Nova Planilha'); setStartMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" /> Planilha
                    </button>
                </div>
            </div>
        )}

        {/* Taskbar Context Menu */}
        {contextMenu && (
            <div 
                ref={contextMenuRef}
                className="fixed z-[10000] bg-[#1e1e20] border border-zinc-700 rounded-lg shadow-xl w-48 py-1 animate-in fade-in zoom-in-95"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <button onClick={() => { toggleMinimize(contextMenu.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                    <Minus className="w-3 h-3" /> Minimizar/Restaurar
                </button>
                <button onClick={() => { focusWindow(contextMenu.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                    <Maximize2 className="w-3 h-3" /> Focar
                </button>
                <button onClick={() => { centerWindow(contextMenu.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                    <Layout className="w-3 h-3" /> Restaurar Centralizado
                </button>
                <div className="h-px bg-zinc-700 my-1" />
                <button onClick={() => { closeWindow(contextMenu.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2">
                    <X className="w-3 h-3" /> Fechar
                </button>
            </div>
        )}

        {/* Taskbar Bar */}
        <div className="h-12 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/10 flex items-center px-2 justify-between z-[9990] absolute bottom-0 w-full select-none shadow-2xl">
            
            <div className="flex items-center gap-2">
                {/* Start Button */}
                <button 
                    onClick={() => setStartMenuOpen(!startMenuOpen)}
                    className={cn(
                        "w-9 h-9 rounded flex items-center justify-center transition-all hover:bg-white/10 active:scale-95",
                        startMenuOpen ? "bg-white/10 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : ""
                    )}
                >
                    <Zap className={cn("w-5 h-5", startMenuOpen ? "text-primary" : "text-zinc-400")} />
                </button>

                <div className="w-px h-6 bg-zinc-700 mx-1" />

                {/* Open Windows */}
                <div className="flex items-center gap-1">
                    {windows.map((win) => {
                        const isActive = activeWindowId === win.id && !win.isMinimized;
                        return (
                            <div
                                key={win.id}
                                onClick={() => handleWindowClick(win.id, win.isMinimized, activeWindowId === win.id)}
                                onContextMenu={(e) => handleContextMenu(e, win.id)}
                                className={cn(
                                    "flex items-center gap-2 px-3 h-9 rounded border transition-all max-w-[180px] cursor-pointer group relative",
                                    isActive
                                        ? "bg-zinc-800/80 border-zinc-600 text-white shadow-sm" 
                                        : "bg-transparent border-transparent text-zinc-400 hover:bg-white/5 hover:border-white/5"
                                )}
                            >
                                {getIcon(win.type)}
                                <span className="text-xs truncate hidden md:block select-none">{win.title}</span>
                                {win.isDirty && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 absolute top-1 right-1" title="Não salvo" />}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Tray Area */}
            <div className="flex items-center gap-4 px-2">
                <div className="flex flex-col items-end leading-none">
                    <span className="text-xs font-medium text-zinc-200">{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className="text-[10px] text-zinc-500">{time.toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    </>
  );
}
