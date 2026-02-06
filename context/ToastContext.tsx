
'use client';

import React, { createContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextData {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextData>({} as ToastContextData);

interface ToastProviderProps {
  children?: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  // Garante que o Portal só renderize no cliente após a montagem
  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback(({ type, title, message, duration = 4000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((state) => [...state, { id, type, title, message, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((state) => state.filter((toast) => toast.id !== id));
  }, []);

  // Configuração de Cores por Tipo
  const typeStyles = {
    success: {
      icon: CheckCircle2,
      glow: 'via-emerald-500',
      iconBox: 'bg-emerald-500/10 text-emerald-500',
      title: 'text-white'
    },
    error: {
      icon: AlertCircle,
      glow: 'via-red-500',
      iconBox: 'bg-red-500/10 text-red-500',
      title: 'text-white'
    },
    warning: {
      icon: AlertTriangle,
      glow: 'via-yellow-500',
      iconBox: 'bg-yellow-500/10 text-yellow-500',
      title: 'text-white'
    },
    info: {
      icon: Info,
      glow: 'via-blue-500',
      iconBox: 'bg-blue-500/10 text-blue-400',
      title: 'text-white'
    }
  };

  // Renderização do conteúdo das notificações
  const ToastContainer = () => (
    <div 
      className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none items-end"
      role="region" 
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const config = typeStyles[toast.type];
        const Icon = config.icon;

        return (
          <div 
            key={toast.id}
            className={cn(
                "pointer-events-auto w-96 bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.6)] relative overflow-hidden backdrop-blur-2xl ring-1 ring-white/10 animate-in slide-in-from-right-10 fade-in duration-300 p-5",
            )}
          >
            {/* Glow Topo (Igual ao GlobalSync) */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${config.glow} to-transparent opacity-75`} />

            <div className="flex items-start gap-4 relative z-10">
              {/* Ícone em Box */}
              <div className={cn("p-3 rounded-xl transition-colors duration-500 shadow-inner shrink-0", config.iconBox)}>
                 <Icon className="w-6 h-6" />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className={cn("text-base font-bold leading-tight mb-1", config.title)}>{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed break-words opacity-90">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Botão Fechar */}
              <button 
                onClick={() => removeToast(toast.id)}
                className="text-zinc-500 hover:text-white transition-colors p-1 -mr-2 -mt-2 rounded-md hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de Progresso Sutil no Fundo */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/10 w-full rounded-full overflow-hidden">
                 <div 
                    className={cn("h-full opacity-50", config.iconBox.split(' ')[0].replace('/10', ''))} // Usa a cor do bg do ícone sem opacidade baixa
                    style={{ 
                        width: '100%', 
                        animation: `shrink ${toast.duration}ms linear forwards` 
                    }} 
                 />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {mounted && typeof document !== 'undefined' 
        ? createPortal(<ToastContainer />, document.body) 
        : null}
    </ToastContext.Provider>
  );
}
