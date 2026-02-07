'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NAV_ITEMS } from './NavConfig';
import { cn } from '@/lib/utils';
import { LogOut, Zap, ChevronRight, ChevronLeft } from 'lucide-react';

interface NavItem {
  icon: any;
  label: string;
  href: string;
  rightSide?: boolean;
}

interface DockItemProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
}

const DockItem: React.FC<DockItemProps> = ({ item, isActive, isExpanded }) => (
  <Link 
    href={item.href}
    className={cn(
      "group relative flex items-center rounded-xl transition-all duration-300 overflow-hidden shrink-0",
      isExpanded ? "w-full px-4 justify-start gap-3 h-14" : "w-12 justify-center h-12",
      isActive 
        ? "bg-primary/20 text-primary shadow-[0_0_20px_-5px_rgba(34,197,94,0.6)] border border-primary/30" 
        : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:border-white/10 border border-transparent"
    )}
  >
    <item.icon className={cn(
        "transition-transform duration-300 shrink-0", 
        isExpanded ? "w-5 h-5" : "w-6 h-6 group-hover:scale-110",
        isActive && "scale-105"
    )} />
    
    {/* Texto com Animação de Entrada */}
    <span className={cn(
        "text-sm font-bold whitespace-nowrap transition-all duration-500 origin-left",
        isExpanded ? "opacity-100 translate-x-0 w-auto" : "opacity-0 -translate-x-10 w-0"
    )}>
      {item.label}
    </span>

    {/* Glow Ativo (Apenas se expandido e ativo) */}
    {isActive && isExpanded && (
        <div className="absolute right-3 w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
    )}
  </Link>
);

export function DesktopDocks() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  
  // Estados independentes para hover
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  // Base Classes para os Paineis
  const dockBaseClasses = "pointer-events-auto fixed top-1/2 -translate-y-1/2 bg-[#050505]/90 backdrop-blur-3xl border border-zinc-800/80 rounded-3xl flex flex-col gap-2 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] z-[100] shadow-[0_0_50px_-10px_rgba(0,0,0,1)] ring-1 ring-white/5";
  
  // Neon Glow quando expandido
  const activeGlow = "hover:border-primary/50 hover:shadow-[0_0_60px_-15px_rgba(34,197,94,0.4)]";

  return (
    <div className="hidden lg:block pointer-events-none fixed inset-0 z-40">
      
      {/* DOCK ESQUERDA (OPERACIONAL) */}
      <nav 
        onMouseEnter={() => setHoverLeft(true)}
        onMouseLeave={() => setHoverLeft(false)}
        className={cn(
            dockBaseClasses, activeGlow,
            "left-6 p-3",
            hoverLeft ? "w-64 items-start" : "w-20 items-center"
        )}
      >
        {/* Logo Header */}
        <div className={cn("mb-2 flex items-center transition-all duration-500", hoverLeft ? "w-full justify-between px-2" : "justify-center")}>
            <div className="w-10 h-10 bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center border border-zinc-800 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                <Zap className="w-5 h-5 text-primary fill-primary/20" />
            </div>
            {hoverLeft && (
                <span className="text-white font-bold tracking-wider text-lg animate-in fade-in slide-in-from-left-4 duration-500">
                    WANCORA
                </span>
            )}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-1 opacity-50" />

        <div className="flex-1 flex flex-col gap-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
            {NAV_ITEMS.main.map((item) => {
                if (item.label === 'Mesa') return null;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return <DockItem key={item.href} item={item} isActive={!!isActive} isExpanded={hoverLeft} />;
            })}
        </div>
        
        {/* Indicador Visual de Expansão (Seta) */}
        {!hoverLeft && (
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4 text-zinc-600 animate-pulse" />
            </div>
        )}
      </nav>

      {/* DOCK DIREITA (UTILITÁRIO) */}
      <nav 
        onMouseEnter={() => setHoverRight(true)}
        onMouseLeave={() => setHoverRight(false)}
        className={cn(
            dockBaseClasses, activeGlow,
            "right-6 p-3",
            hoverRight ? "w-64 items-end" : "w-20 items-center"
        )}
      >
        {/* Avatar Header */}
        <div className={cn("mb-2 flex items-center transition-all duration-500", hoverRight ? "w-full flex-row-reverse justify-between px-2" : "justify-center")}>
             <div className={cn("relative group transition-all duration-300", hoverRight ? "scale-100" : "scale-90")}>
                <div className={cn("w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border-2 overflow-hidden shadow-lg", user?.company_id ? "border-green-500 shadow-green-500/20" : "border-zinc-700")}>
                    {user?.avatar_url ? (
                        <img src={user.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                    )}
                </div>
                <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
             </div>
             
             {hoverRight && (
                 <div className="text-right animate-in fade-in slide-in-from-right-4 duration-500">
                     <p className="text-sm font-bold text-white leading-none truncate max-w-[140px]">{user?.name}</p>
                     <p className="text-[10px] text-zinc-500 font-mono mt-1">ONLINE</p>
                 </div>
             )}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-1 opacity-50" />

        <div className="flex-1 flex flex-col gap-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
            {NAV_ITEMS.utility.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return <DockItem key={item.href} item={{...item, rightSide: true}} isActive={!!isActive} isExpanded={hoverRight} />;
            })}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mt-1 opacity-50" />

        <button 
            onClick={handleLogout}
            className={cn(
                "group relative flex items-center rounded-xl transition-all duration-300 overflow-hidden shrink-0",
                hoverRight ? "w-full px-4 justify-start gap-3 h-14 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent" : "w-12 justify-center h-12 text-zinc-500 hover:text-red-500",
            )}
        >
            <LogOut className={cn("shrink-0 transition-colors", hoverRight ? "w-5 h-5 text-red-400" : "w-6 h-6")} />
            <span className={cn(
                "text-sm font-bold text-red-400 whitespace-nowrap transition-all duration-500 origin-left",
                hoverRight ? "opacity-100 w-auto" : "opacity-0 w-0"
            )}>
                Encerrar Sessão
            </span>
        </button>
      </nav>

    </div>
  );
}
