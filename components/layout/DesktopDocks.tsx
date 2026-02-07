'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NAV_ITEMS } from './NavConfig';
import { cn } from '@/lib/utils';
import { LogOut, Zap } from 'lucide-react';

interface NavItem {
  icon: any;
  label: string;
  href: string;
  rightSide?: boolean;
}

interface DockItemProps {
  item: NavItem;
  isActive: boolean;
}

// Componente isolado para evitar problemas de re-renderização e tipagem
const DockItem = ({ item, isActive }: DockItemProps) => (
  <Link 
    href={item.href}
    className={cn(
      "group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
      isActive 
        ? "bg-primary/20 text-primary shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]" 
        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
    )}
  >
    <item.icon className={cn("w-6 h-6 transition-transform group-hover:scale-110", isActive && "scale-105")} />
    
    {/* Tooltip Lateral */}
    <span className={cn(
      "absolute left-14 px-2 py-1 bg-zinc-900 border border-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl",
      // Ajuste para o Dock da Direita mostrar tooltip na esquerda
      item.rightSide && "left-auto right-14"
    )}>
      {item.label}
    </span>
  </Link>
);

export function DesktopDocks() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="hidden lg:block pointer-events-none fixed inset-0 z-40">
      
      {/* DOCK ESQUERDA (OPERACIONAL) */}
      <nav className="pointer-events-auto fixed left-6 top-1/2 -translate-y-1/2 bg-[#09090b]/80 backdrop-blur-2xl border border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
        
        {/* Logo Mini */}
        <div className="mb-2 flex justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-black rounded-lg flex items-center justify-center border border-zinc-700 shadow-inner">
                <Zap className="w-5 h-5 text-primary fill-primary/20" />
            </div>
        </div>

        <div className="w-full h-px bg-zinc-800/50 mb-1" />

        {NAV_ITEMS.main.map((item) => {
            if (item.label === 'Mesa') return null; // Mesa fica na direita no desktop
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return <DockItem key={item.href} item={item} isActive={!!isActive} />;
        })}
      </nav>

      {/* DOCK DIREITA (UTILITÁRIO) */}
      <nav className="pointer-events-auto fixed right-6 top-1/2 -translate-y-1/2 bg-[#09090b]/80 backdrop-blur-2xl border border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
        
        {/* Avatar Mini */}
        <div className="mb-2 flex justify-center relative group">
             <div className={cn("w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border-2 overflow-hidden", user?.company_id ? "border-green-500/30" : "border-zinc-700")}>
                {user?.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-xs font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                )}
             </div>
             <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-950 animate-pulse" />
        </div>

        <div className="w-full h-px bg-zinc-800/50 mb-1" />

        {NAV_ITEMS.utility.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return <DockItem key={item.href} item={{...item, rightSide: true}} isActive={!!isActive} />;
        })}

        <div className="w-full h-px bg-zinc-800/50 mt-1" />

        <button 
            onClick={handleLogout}
            className="group relative flex items-center justify-center w-12 h-12 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
            <LogOut className="w-5 h-5" />
            <span className="absolute right-14 px-2 py-1 bg-red-950 border border-red-900 text-red-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Sair
            </span>
        </button>
      </nav>

    </div>
  );
}