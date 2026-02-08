
'use client';

import React from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCloudPage = pathname === '/cloud';

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col lg:flex-row overflow-hidden">
      {/* Navegação Mobile (Aparece apenas em telas pequenas) */}
      <MobileNav />

      {/* Navegação Desktop (Sidebar Nova - Aparece apenas em telas grandes) */}
      <Sidebar />

      {/* Conteúdo Principal 
          flex-1: Ocupa o espaço restante
          relative: Contexto de posicionamento
          Se for Cloud Page, removemos o overflow do main para o próprio componente gerenciar (evita scroll duplo)
      */}
      <main className={cn(
          "flex-1 w-full relative bg-[#09090b] transition-all duration-300",
          isCloudPage ? "h-screen overflow-hidden" : "h-[100dvh] overflow-y-auto overflow-x-hidden"
      )}>
        {/* 
            Container Central "Cockpit"
            LÓGICA HÍBRIDA:
            - Se for /cloud: Padding ZERO, Largura TOTAL, Altura TOTAL.
            - Outras páginas: Padding padrão e Max Width.
        */}
        <div className={cn(
            "min-h-full transition-all duration-300",
            isCloudPage 
                ? "p-0 w-full h-full" // Full Screen para Desktop
                : "pt-20 pb-24 px-4 lg:pt-8 lg:pb-8 lg:px-12 max-w-[1600px] mx-auto" // Padrão Dashboard
        )}>
            {children}
        </div>
      </main>
    </div>
  );
}
