
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useDesktopStore, WindowInstance } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';

export interface WindowFrameProps {
  window: WindowInstance;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ window, children }) => {
  const { closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateWindowPosition } = useDesktopStore();

  if (window.isMinimized) return null;

  return (
    <motion.div
      drag={!window.isMaximized}
      dragMomentum={false}
      onDragEnd={(_, info) => updateWindowPosition(window.id, info.offset.x, info.offset.y)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        x: window.isMaximized ? 0 : window.position.x,
        y: window.isMaximized ? 0 : window.position.y,
        width: window.isMaximized ? '100%' : window.size.width,
        height: window.isMaximized ? '100%' : window.size.height,
      }}
      style={{ 
        zIndex: window.zIndex,
        position: window.isMaximized ? 'absolute' : 'absolute',
        top: window.isMaximized ? 0 : 0,
        left: window.isMaximized ? 0 : 0,
      }}
      className={cn(
        "flex flex-col bg-[#0f0f11] border border-zinc-800 shadow-2xl overflow-hidden backdrop-blur-xl",
        window.isMaximized ? "rounded-none inset-0 w-full h-full" : "rounded-lg"
      )}
      onMouseDown={() => focusWindow(window.id)}
    >
      {/* Title Bar */}
      <div 
        className="h-10 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between px-3 cursor-default select-none shrink-0"
        onDoubleClick={() => toggleMaximize(window.id)}
      >
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer flex items-center justify-center group" onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}>
                <X className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer flex items-center justify-center group" onClick={(e) => { e.stopPropagation(); toggleMinimize(window.id); }}>
                <Minus className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer flex items-center justify-center group" onClick={(e) => { e.stopPropagation(); toggleMaximize(window.id); }}>
                {window.isMaximized ? <MinimizeIcon /> : <MaximizeIcon />}
            </div>
        </div>
        
        <div className="text-xs font-bold text-zinc-400 flex items-center gap-2">
            {window.title}
        </div>
        
        <div className="w-14" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {children}
      </div>
    </motion.div>
  );
};

const MaximizeIcon = () => <Maximize2 className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
const MinimizeIcon = () => <Square className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
