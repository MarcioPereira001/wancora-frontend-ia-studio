
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
  const dragControls = useDragControls(); // Hook para controlar o arraste programaticamente
  
  // Estado local para confirmação de fechamento
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

  // Handler para iniciar o arraste apenas ao clicar no Header
  const startDrag = (event: React.PointerEvent) => {
      if (!win.isMaximized) {
          dragControls.start(event);
      }
  };

  if (win.isMinimized) return null;

  return (
    <>
    <motion.div
      drag={!win.isMaximized} // Só permite drag se não estiver maximizada
      dragControls={dragControls} // Controle manual pelo Header
      dragListener={false} // Desativa o listener automático no corpo da janela
      dragMomentum={false} // Sem inércia para parar exatamente onde soltar
      dragElastic={0} // Sem efeito elástico nas bordas (Hard Stop)
      dragConstraints={constraintsRef} // Limita ao container pai (DesktopEnvironment)
      
      onDragEnd={(_, info) => {
          // Só atualiza o estado global quando o usuário soltar a janela
          // Isso evita o loop de renderização que causava o travamento
          const newX = win.position.x + info.offset.x;
          const newY = win.position.y + info.offset.y;
          updateWindowPosition(win.id, newX, newY);
      }}

      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        // Mantém a posição visual sincronizada
        x: 0, 
        y: 0 
      }}
      
      style={{ 
        zIndex: win.zIndex,
        position: 'absolute',
        // Usa as coordenadas do estado global como base
        top: win.isMaximized ? 0 : win.position.y,
        left: win.isMaximized ? 0 : win.position.x,
        width: win.isMaximized ? '100%' : win.size.width,
        height: win.isMaximized ? '100%' : win.size.height,
      }}
      
      className={cn(
        "flex flex-col bg-[#0f0f11] border border-zinc-800 shadow-2xl overflow-hidden backdrop-blur-xl transition-shadow",
        win.isMaximized ? "rounded-none fixed inset-0" : "rounded-lg",
        useDesktopStore.getState().activeWindowId === win.id ? "shadow-[0_0_30px_rgba(0,0,0,0.5)] border-zinc-700" : "opacity-90"
      )}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Title Bar (Drag Handle) */}
      <div 
        className="h-10 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between px-3 select-none shrink-0 cursor-default active:cursor-grabbing"
        onPointerDown={startDrag} // Inicia o arraste
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
        
        <div className="text-xs font-bold text-zinc-400 flex items-center gap-2 pointer-events-none">
            {win.title} {win.isDirty && <span className="text-yellow-500">*</span>}
        </div>
        
        <div className="w-14" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {children}
      </div>
    </motion.div>

    {/* Modal de Confirmação de Fechamento */}
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
