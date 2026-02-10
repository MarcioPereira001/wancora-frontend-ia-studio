
'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { SystemLogger } from '@/lib/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  // Fix: Declaração explícita para evitar erro TS2339
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Captura o erro de renderização e envia para a fila de logs
    try {
        SystemLogger.error('React Render Crash', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });
    } catch (e) {
        // Fallback final: se o logger falhar, loga no console nativo
        console.error("Critical: Logger failed inside ErrorBoundary", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white p-4 animate-in fade-in">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 mb-6 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Erro de Renderização</h1>
            <p className="text-zinc-400 text-center max-w-md mb-8 text-sm leading-relaxed">
                A interface encontrou um problema inesperado. Um relatório técnico foi gerado e enviado automaticamente para a administração.
            </p>
            <Button 
                onClick={() => window.location.reload()} 
                className="bg-white text-black hover:bg-zinc-200 font-bold"
            >
                <RefreshCw className="w-4 h-4 mr-2" /> Recarregar Aplicação
            </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
