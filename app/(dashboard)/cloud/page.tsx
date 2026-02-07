
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
            Container "Monitor Virtual" Restaurado:
            - h-full: Ocupa toda a altura do container pai (DashboardLayout).
            - rounded-xl: Bordas arredondadas sutis.
            - sem margens excessivas.
        */}
        <div className="relative w-full h-full bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 backdrop-blur-sm">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
