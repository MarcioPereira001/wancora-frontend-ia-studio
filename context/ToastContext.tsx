'use client';

import React, { createContext, useState, useCallback, ReactNode } from 'react';
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

  const addToast = useCallback(({ type, title, message, duration = 4000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    setToasts((state) => [...state, { id, type, title, message, duration }]);

    if (duration > 0) {
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((state) => state.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Container de Notificações - Z-Index Extremo para sobreposição total */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
            <div 
                key={toast.id}
                className={`
                    pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-full duration-300
                    ${toast.type === 'success' ? 'bg-zinc-950/95 border-green-500/50 text-zinc-100 shadow-green-500/10' : ''}
                    ${toast.type === 'error' ? 'bg-zinc-950/95 border-red-500/50 text-zinc-100 shadow-red-500/10' : ''}
                    ${toast.type === 'info' ? 'bg-zinc-950/95 border-blue-500/50 text-zinc-100 shadow-blue-500/10' : ''}
                    ${toast.type === 'warning' ? 'bg-zinc-950/95 border-yellow-500/50 text-zinc-100 shadow-yellow-500/10' : ''}
                `}
            >
                <div className="mt-0.5 shrink-0">
                    {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                    {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold">{toast.title}</h4>
                    {toast.message && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{toast.message}</p>}
                </div>
                <button 
                    onClick={() => removeToast(toast.id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-white/5 rounded"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}