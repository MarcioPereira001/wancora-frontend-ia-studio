'use client';

import React, { useState } from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
// REMOVIDO: import { GlobalSyncIndicator } from '@/components/layout/GlobalSyncIndicator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Mobile Menu Button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-zinc-900 border-zinc-800 text-white shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Wrapper for Mobile */}
      <div className={`
        fixed inset-0 z-40 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Component */}
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
        
        {/* Overlay for Mobile */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full md:ml-0 overflow-y-auto bg-zinc-950/50 p-4 md:p-8 pt-16 md:pt-8 relative">
        <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
        </div>
        
        {/* O GlobalSyncIndicator foi movido para app/layout.tsx para cobrir toda a aplicação */}
      </main>
    </div>
  );
}