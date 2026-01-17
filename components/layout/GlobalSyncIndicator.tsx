'use client';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { RefreshCw, CheckCircle2, CloudDownload } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);

  // Encontra QUALQUER instância que esteja sincronizando ou com progresso pendente
  const syncingInstance = instances.find(i => 
    i.sync_status === 'syncing' || 
    (i.sync_percent !== undefined && i.sync_percent > 0 && i.sync_percent < 100)
  );

  useEffect(() => {
    if (syncingInstance) {
      setShow(true);
    } else {
      // Pequeno delay para esconder suavemente
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [syncingInstance]);

  if (!syncingInstance && !show) return null;

  const percent = syncingInstance?.sync_percent || 100;
  const isComplete = !syncingInstance && show; // Estado final antes de sumir

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[99999] pointer-events-none">
      {/* Card Flutuante com Sombra Forte */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-4 w-80 animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto">
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
               ) : (
                 <CloudDownload className="w-5 h-5 text-blue-500 animate-pulse" />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1">
                {isComplete ? 'Sincronização Concluída' : 'Baixando Histórico'}
              </span>
              <span className="text-[10px] text-zinc-400">
                {isComplete ? 'Tudo pronto para uso.' : 'Não feche o sistema.'}
              </span>
            </div>
          </div>
          <span className="text-lg font-mono font-bold text-white">{percent}%</span>
        </div>

        {/* Barra de Progresso */}
        {!isComplete && (
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300 ease-out relative"
              style={{ width: `${percent}%` }}
            >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
2. RELOCAR PARA app/layout.tsx (Root Layout)
Para garantir que sobreponha TUDO (inclusive se o usuário estiver numa rota que não é dashboard, ou se houver erro de aninhamento), vamos mover a importação para a raiz absoluta.

Arquivo: app/layout.tsx Adicione o componente logo antes de fechar o </body>.

TypeScript

import { GlobalSyncIndicator } from '@/components/layout/GlobalSyncIndicator';
// ... outros imports

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={...}>
        <Providers>
           {children}
           <Toaster />
           {/* ADICIONE AQUI PARA FICAR SOBRE TUDO O TEMPO TODO */}
           <GlobalSyncIndicator /> 
        </Providers>
      </body>
    </html>
  );
}
(Nota: Remova a importação antiga de app/(dashboard)/layout.tsx para não duplicar o componente).

3. VERIFICAÇÃO FINAL
Certifique-se de que o componente ChatWindow ou Sidebar não tenham um z-index superior a 99999. O indicador deve ser o elemento mais alto da tela.
