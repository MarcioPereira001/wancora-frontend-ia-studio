
import { useContext } from 'react';
import { ToastContext, Toast } from '../context/ToastContext';
import { SystemLogger } from '@/lib/logger';

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  // Wrapper para interceptar e logar erros
  const addToast = (toast: Omit<Toast, 'id'>) => {
      if (toast.type === 'error') {
          SystemLogger.error(`Toast Error: ${toast.title}`, {
              message: toast.message,
              duration: toast.duration
          });
      }
      context.addToast(toast);
  };

  return {
      ...context,
      addToast // Sobrescreve a função original
  };
}
