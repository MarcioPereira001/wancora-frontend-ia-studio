
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
            Container "Monitor Virtual":
            - relative: Prende os elementos absolutos do DesktopEnvironment aqui dentro.
            - h-[85vh]: Altura fixa calculada para caber na tela sem scroll excessivo.
            - rounded-3xl/border: Estética de "tela" isolada.
            - mx-auto: Garante centralização extra se a largura for menor que o container pai.
        */}
        <div className="relative w-full h-[85vh] bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5 mx-auto backdrop-blur-sm mt-2">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
