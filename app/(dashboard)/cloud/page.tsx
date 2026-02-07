
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
            Container "Monitor Virtual" Limpo:
            - h-full: Ocupa toda a altura.
            - Removido bg-zinc-900/50 e backdrop-blur para não escurecer o wallpaper.
            - Mantido apenas borda e shadow para estrutura.
        */}
        <div className="relative w-full h-full border border-zinc-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 bg-black">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
