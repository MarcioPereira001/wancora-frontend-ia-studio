
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
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col">
      {/* Navegação Mobile (Top + Bottom) */}
      <MobileNav />

      {/* Navegação Desktop (Sidebars Flutuantes) */}
      <DesktopDocks />

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full relative">
        {/* 
            Container Responsivo Inteligente 
            - Mobile: Padding Top 16 (Header) + Padding Bottom 24 (Nav)
            - Desktop: Padding X (Para não bater nos Docks) + Max Width controlado
        */}
        <div className="pt-20 pb-24 px-4 md:pt-8 md:pb-8 lg:px-28 max-w-[1800px] mx-auto min-h-[calc(100vh-80px)]">
            {children}
        </div>
      </main>
    </div>
  );
}
