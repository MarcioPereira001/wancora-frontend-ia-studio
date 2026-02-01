
'use client';

import React, { Suspense } from 'react';
import { DesktopEnvironment } from '@/components/desktop/DesktopEnvironment';
import { Loader2 } from 'lucide-react';

// Wrapper Principal com Suspense (Correção do Build)
export default function CloudPage() {
  return (
    <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
    }>
        <div className="h-[calc(100vh-64px)] md:h-screen flex flex-col overflow-hidden">
            <DesktopEnvironment />
        </div>
    </Suspense>
  );
}
