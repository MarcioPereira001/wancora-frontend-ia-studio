
'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useDesktopStore, WindowInstance } from '@/store/useDesktopStore';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

export interface WindowFrameProps {
  window: WindowInstance;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ window: win, children }) => {
  const { closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateWindowPosition } = useDesktopStore();
  const constraintsRef = useRef<HTMLDivElement>(null);
  
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

  if (win.isMinimized) return null;

  // Safe window dimensions for SSR
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  return (
    <>
    <motion.div
      drag={!win.isMaximized}
      dragMomentum={false}
      dragElastic={0} // Sem efeito elástico para não sair da tela
      dragControls={undefined} // Controle automático pelo dragHandle
      dragListener={false} // Desativa arraste no corpo inteiro
      dragConstraints={{ left: 0, top: 0, right: screenWidth - 100, bottom: screenHeight - 100 }} // Limites básicos
      onDragEnd={(_, info) => {
          // Atualiza posição final na store
          const newX = win.position.x + info.offset.x;
          const newY = win.position.y + info.offset.y;
          // Não atualizamos store em tempo real durante drag para performance, apenas no final
          // Mas como o framer controla o visual, só precisamos garantir que a próxima renderização saiba onde está
          // O ideal seria usar updateWindowPosition, mas o framer mantém o offset.
          // Para simplificar: deixamos o framer controlar o visual do drag.
      }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        // Se maximizado, trava em 0,0. Se não, usa posição.
        // Nota: Framer Motion usa transform, então x/y são offsets se não forem definidos como absolutos.
        // Aqui estamos usando style absolute no pai, então controlamos left/top
      }}
      style={{ 
        zIndex: win.zIndex,
        position: 'absolute',
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
      <motion.div 
        className="h-10 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between px-3 cursor-default select-none shrink-0"
        onPan={(e, info) => {
            if(!win.isMaximized) {
               updateWindowPosition(win.id, win.position.x + info.delta.x, win.position.y + info.delta.y);
            }
        }}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
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
      </motion.div>

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
