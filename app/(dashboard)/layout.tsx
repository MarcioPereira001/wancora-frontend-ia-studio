
'use client';

import React from 'react';
import { DesktopDocks } from "@/components/layout/DesktopDocks";
import { MobileNav } from "@/components/layout/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col overflow-x-hidden">
      {/* Navegação Mobile (Top + Bottom) */}
      <MobileNav />

      {/* Navegação Desktop (Sidebars Flutuantes) */}
      <DesktopDocks />

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full relative z-0">
        {/* 
            Container Central "Cockpit"
            - Mobile: Paddings padrão
            - Desktop: Margens laterais grandes (px-32/px-40) para não tocar nas barras flutuantes (w-20 + margin).
            - Centralização absoluta com max-w controlado.
        */}
        <div className="
            pt-20 pb-24 px-4 
            md:pt-8 md:pb-8 
            lg:px-32 xl:px-44 
            max-w-[1600px] mx-auto 
            min-h-[calc(100vh-60px)]
        ">
            {children}
        </div>
      </main>
    </div>
  );
}
