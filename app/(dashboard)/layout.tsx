
'use client';

import React from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col lg:flex-row overflow-hidden">
      {/* Navegação Mobile (Aparece apenas em telas pequenas) */}
      <MobileNav />

      {/* Navegação Desktop (Sidebar Nova - Aparece apenas em telas grandes) */}
      <Sidebar />

      {/* Conteúdo Principal 
          flex-1: Ocupa o espaço restante
          overflow-y-auto: Permite scroll independente do sidebar
          relative: Contexto de posicionamento
      */}
      <main className="flex-1 w-full relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#09090b]">
        {/* 
            Container Central "Cockpit"
            Ajustado para o novo layout flexível (remove margens fixas gigantes)
        */}
        <div className="
            pt-20 pb-24 px-4 
            lg:pt-8 lg:pb-8 
            lg:px-12 
            max-w-[1600px] mx-auto 
            min-h-full
        ">
            {children}
        </div>
      </main>
    </div>
  );
}
