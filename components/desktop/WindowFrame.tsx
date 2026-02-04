
'use client';

import React, { useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useDesktopStore, WindowInstance } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

export interface WindowFrameProps {
  window: WindowInstance;
  children: React.ReactNode;
  constraintsRef?: React.RefObject<HTMLDivElement | null>;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ window: win, children, constraintsRef }) => {
  const { closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateWindowPosition } = useDesktopStore();
  const dragControls = useDragControls();
  
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseRequest = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (win.isDirty) {
          setShowCloseConfirm(true);
      } else {
          closeWindow(win.id);
      }
  };

  const confirmClose = () => {
      closeWindow(win.id);
      setShowCloseConfirm(false);
  };

  const startDrag = (event: React.PointerEvent) => {
      if (!win.isMaximized) {
          dragControls.start(event);
      }
  };

  if (win.isMinimized) return null;

  return (
    <>
    <motion.div
      drag={!win.isMaximized}
      dragControls={dragControls}
      dragListener={false} 
      dragMomentum={false} 
      dragElastic={0}
      dragConstraints={constraintsRef}
      
      // CRÍTICO: Sincroniza a posição visual final com o estado do React
      // O Framer mantém o offset transform. Precisamos usar o layout absolute top/left
      onDragEnd={(_, info) => {
          const newX = win.position.x + info.offset.x;
          const newY = win.position.y + info.offset.y;
          updateWindowPosition(win.id, newX, newY);
      }}

      // CRÍTICO: Sempre reseta o transform x/y para 0, pois controlamos via Top/Left
      // Isso impede que o Framer some o offset anterior com a nova posição absoluta
      style={{ 
        zIndex: win.zIndex,
        position: 'absolute',
        top: win.isMaximized ? 0 : win.position.y,
        left: win.isMaximized ? 0 : win.position.x,
        width: win.isMaximized ? '100vw' : win.size.width,
        height: win.isMaximized ? 'calc(100vh - 48px)' : win.size.height, // Desconta Taskbar
        x: 0,
        y: 0
      }}
      
      className={cn(
        "flex flex-col bg-[#1e1e20] border border-zinc-800 shadow-2xl overflow-hidden transition-shadow",
        win.isMaximized ? "rounded-none fixed top-0 left-0 right-0 border-0" : "rounded-lg",
        useDesktopStore.getState().activeWindowId === win.id ? "shadow-[0_0_40px_rgba(0,0,0,0.6)] border-zinc-600" : "opacity-95"
      )}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Title Bar */}
      <div 
        className={cn(
            "h-9 flex items-center justify-between px-3 select-none shrink-0 cursor-default",
            win.isMaximized ? "bg-zinc-900" : "bg-zinc-800/80"
        )}
        onPointerDown={startDrag} 
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer flex items-center justify-center group" onClick={handleCloseRequest}>
                <X className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer flex items-center justify-center group" onClick={(e) => { e.stopPropagation(); toggleMinimize(win.id); }}>
                <Minus className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer flex items-center justify-center group" onClick={(e) => { e.stopPropagation(); toggleMaximize(win.id); }}>
                {win.isMaximized ? <MinimizeIcon /> : <MaximizeIcon />}
            </div>
        </div>
        
        <div className="text-xs font-medium text-zinc-400 flex items-center gap-2 pointer-events-none truncate px-4">
            {win.title} {win.isDirty && <span className="text-yellow-500">*</span>}
        </div>
        
        <div className="w-14" /> 
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-[#121212]">
        {children}
      </div>
    </motion.div>

    <Modal isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} title="Alterações não salvas" maxWidth="sm">
        <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
                Você tem alterações não salvas em <strong>{win.title}</strong>. 
                Se fechar agora, você perderá o progresso não salvo.
            </p>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowCloseConfirm(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={confirmClose}>Fechar sem Salvar</Button>
            </div>
        </div>
    </Modal>
    </>
  );
};

const MaximizeIcon = () => <Maximize2 className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
const MinimizeIcon = () => <Square className="w-2 h-2 text-black opacity-0 group-hover:opacity-100" />
