'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SystemLogger } from '@/lib/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Evita loop infinito se o logger falhar
    try {
        SystemLogger.error('React Render Crash', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });
    } catch (e) {
        console.error("Falha crítica no Logger:", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 mb-6 animate-pulse">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
            <p className="text-zinc-400 text-center max-w-md mb-8">
                Ocorreu um erro inesperado na interface. Nossos engenheiros (o Admin) já foram notificados automaticamente.
            </p>
            <Button 
                onClick={() => window.location.reload()} 
                className="bg-white text-black hover:bg-zinc-200"
            >
                <RefreshCw className="w-4 h-4 mr-2" /> Recarregar Página
            </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
