
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
            FIX CRÍTICO DE RENDERIZAÇÃO:
            1. h-[85vh]: Define altura explícita. 'h-full' estava colapsando para 0px porque o pai tem 'min-h'.
            2. Removido 'bg-black': Permite que o wallpaper do DesktopEnvironment apareça.
            3. calc(100vh - 6rem): Ajuste fino para desktop para não gerar scroll duplo com o padding do layout.
        */}
        <div className="relative w-full h-[82vh] lg:h-[calc(100vh-6rem)] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 bg-zinc-900/20 backdrop-blur-sm">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
