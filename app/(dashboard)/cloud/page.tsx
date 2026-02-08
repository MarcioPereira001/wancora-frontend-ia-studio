
'use client';

import React, { Suspense } from 'react';
import { DesktopEnvironment } from '@/components/desktop/DesktopEnvironment';
import { Loader2 } from 'lucide-react';

// Wrapper Principal com Suspense
export default function CloudPage() {
  return (
    <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
    }>
        {/* 
            VISUAL FULL SCREEN / IMERSIVO:
            - w-full h-full: Preenche o container do layout (que agora tem padding 0).
            - rounded-none: Cantos retos para encostar nas bordas da tela.
            - border-none: Sem bordas físicas.
            - bg-zinc-900/20: Fundo sutil enquanto carrega o wallpaper.
        */}
        <div className="relative w-full h-full bg-zinc-900/20 overflow-hidden">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
