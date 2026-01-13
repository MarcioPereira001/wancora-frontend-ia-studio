'use client';

import React, { createContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

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

  // Renderização do conteúdo das notificações
  const ToastContainer = () => (
    <div 
      className="fixed inset-0 z-[99999] flex flex-col gap-3 pointer-events-none items-center justify-start pt-4 px-4 md:items-end md:justify-start md:p-6"
      role="region" 
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`
            pointer-events-auto w-full md:w-80 flex items-start gap-3 p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-5 fade-in zoom-in-95
            ${toast.type === 'success' ? 'bg-[#09090b]/95 border-green-500/30 text-white shadow-green-500/10' : ''}
            ${toast.type === 'error' ? 'bg-[#09090b]/95 border-red-500/30 text-white shadow-red-500/10' : ''}
            ${toast.type === 'info' ? 'bg-[#09090b]/95 border-blue-500/30 text-white shadow-blue-500/10' : ''}
            ${toast.type === 'warning' ? 'bg-[#09090b]/95 border-yellow-500/30 text-white shadow-yellow-500/10' : ''}
          `}
        >
          {/* Ícone */}
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold leading-none tracking-tight">{toast.title}</h4>
            {toast.message && (
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-medium opacity-90 break-words">
                {toast.message}
              </p>
            )}
          </div>

          {/* Botão Fechar */}
          <button 
            onClick={() => removeToast(toast.id)}
            className="text-zinc-500 hover:text-white transition-colors p-1 -mt-1 -mr-1 rounded-md hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Barra de Progresso (Visual) */}
          <div className="absolute bottom-0 left-0 h-[2px] bg-current opacity-30 w-full animate-[shrink_linear_forwards] origin-left rounded-b-xl" style={{ animationDuration: `${toast.duration}ms` }}></div>
        </div>
      ))}
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