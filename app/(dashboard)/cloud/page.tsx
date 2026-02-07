
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
            Correção de Layout: 
            O DashboardLayout tem padding (p-4 md:p-8). 
            Para o Desktop ser "Full Screen" sem rolagem, usamos margens negativas 
            e posicionamento absoluto para anular o padding e preencher o <main>.
        */}
        <div className="absolute inset-0 -m-4 md:-m-8 overflow-hidden bg-black">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
