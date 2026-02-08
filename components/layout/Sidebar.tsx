
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NAV_ITEMS } from './NavConfig';
import { cn } from '@/lib/utils';
import { LogOut, Zap, ChevronLeft, ChevronRight, ZapOff, PlayCircle } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  
  // Estado de Colapso Manual
  const [manualCollapsed, setManualCollapsed] = useState(false);
  
  // Estado de Auto-Colapso (Feature Nova)
  const [autoCollapseMode, setAutoCollapseMode] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calcula se está colapsado baseado no modo
  const isCollapsed = autoCollapseMode ? !isHovered : manualCollapsed;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  // Estilo Cinza Chumbo com Neon Leve e Borrado
  const sidebarClasses = cn(
      "hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out z-40",
      "bg-[#0a0a0b]/95 backdrop-blur-md", 
      "border-r border-white/5 shadow-[1px_0_20px_-5px_rgba(34,197,94,0.15)]",
      isCollapsed ? "w-16" : "w-60" // Reduzido largura total levemente
  );

  return (
    <aside 
        className={sidebarClasses}
        onMouseEnter={() => autoCollapseMode && setIsHovered(true)}
        onMouseLeave={() => autoCollapseMode && setIsHovered(false)}
    >
      
      {/* --- BOTÃO DE TOGGLE FLUTUANTE (MEIO) --- */}
      {!autoCollapseMode && (
          <button
            onClick={() => setManualCollapsed(!manualCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 bg-[#0a0a0b] border border-zinc-700 text-zinc-400 hover:text-white rounded-full p-1 shadow-lg transition-colors z-50 hover:border-primary/50 hover:shadow-primary/20"
            title={manualCollapsed ? "Expandir" : "Recolher"}
          >
            {manualCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
      )}

      {/* --- HEADER / LOGO --- */}
      <div className="h-14 flex items-center justify-center shrink-0 relative overflow-hidden mt-2">
         <div className={cn("flex items-center gap-2 transition-all duration-300", isCollapsed ? "justify-center w-full px-0" : "px-4 w-full justify-start")}>
            <div className="w-8 h-8 bg-gradient-to-br from-zinc-800 to-black rounded-lg flex items-center justify-center border border-zinc-700 shadow-[0_0_10px_rgba(34,197,94,0.15)] shrink-0">
                <Zap className="w-4 h-4 text-primary fill-primary/20" />
            </div>
            <span className={cn("text-white font-bold tracking-wider text-base transition-opacity duration-300 whitespace-nowrap", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                WANCORA
            </span>
         </div>
      </div>

      {/* --- DIVISOR --- */}
      <div className="w-full px-4 mb-2">
          <div className="h-px bg-white/5" />
      </div>

      {/* --- NAV ITEMS --- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2 px-2 space-y-1">
        
        {/* MAIN SECTION */}
        {NAV_ITEMS.main.map((item) => {
             const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
             return (
                 <NavItem key={item.href} item={item} isActive={!!isActive} isCollapsed={isCollapsed} />
             );
        })}

        {/* UTILITY DIVIDER */}
        <div className={cn("py-2 flex items-center", isCollapsed ? "justify-center" : "px-2")}>
            {isCollapsed ? (
                <div className="w-3 h-px bg-zinc-800" />
            ) : (
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Ferramentas</span>
            )}
        </div>

        {/* UTILITY SECTION */}
        {NAV_ITEMS.utility.map((item) => { 
             const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
             return (
                 <NavItem key={item.href} item={item} isActive={!!isActive} isCollapsed={isCollapsed} />
             );
        })}

      </div>

      {/* --- FOOTER / CONTROLES --- */}
      <div className="p-2 border-t border-white/5 bg-black/20">
          
          <div className={cn("flex items-center gap-2 rounded-lg p-1.5 transition-all duration-300 mb-1", isCollapsed ? "justify-center" : "bg-white/5 border border-white/5")}>
              <div className="relative shrink-0">
                  <div className={cn("w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center border overflow-hidden", user?.company_id ? "border-green-900" : "border-zinc-700")}>
                      {user?.avatar_url ? (
                          <img src={user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                          <span className="text-[10px] font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                      )}
                  </div>
              </div>
              
              {!isCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                      <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                      <p className="text-[9px] text-zinc-500 truncate">{user?.email}</p>
                  </div>
              )}
          </div>

          <div className="flex items-center justify-between gap-1">
              {/* Botão de Logout */}
              <button 
                  onClick={handleLogout}
                  className={cn(
                      "flex items-center rounded-lg transition-all duration-300 group hover:bg-red-500/10 hover:border-red-500/20 border border-transparent flex-1",
                      isCollapsed ? "w-full justify-center py-1.5" : "px-2 py-1.5 gap-2"
                  )}
                  title="Sair"
              >
                  <LogOut className={cn("shrink-0 transition-colors text-zinc-500 group-hover:text-red-400", isCollapsed ? "w-3.5 h-3.5" : "w-3.5 h-3.5")} />
                  {!isCollapsed && (
                      <span className="text-[10px] font-medium text-zinc-400 group-hover:text-red-400 whitespace-nowrap animate-in fade-in duration-300">
                          Sair
                      </span>
                  )}
              </button>

              {/* Botão Discreto Auto-Collapse */}
              {!isCollapsed && (
                  <button 
                    onClick={() => setAutoCollapseMode(!autoCollapseMode)}
                    className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-md transition-colors border",
                        autoCollapseMode 
                            ? "text-primary bg-primary/10 border-primary/20" 
                            : "text-zinc-600 hover:text-zinc-400 border-transparent hover:bg-white/5"
                    )}
                    title={autoCollapseMode ? "Desativar Auto-Recolher" : "Ativar Auto-Recolher"}
                  >
                      {autoCollapseMode ? <PlayCircle size={12} className="fill-primary/20" /> : <ZapOff size={12} />}
                  </button>
              )}
          </div>
      </div>

    </aside>
  );
}

// Subcomponente de Item
interface NavItemProps {
  item: {
    label: string;
    href: string;
    icon: any;
  };
  isActive: boolean;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ item, isActive, isCollapsed }) => (
    <Link 
      href={item.href}
      className={cn(
        "group flex items-center rounded-lg transition-all duration-300 relative overflow-hidden",
        isCollapsed ? "w-10 h-10 justify-center mx-auto" : "w-full px-3 py-2 gap-3",
        isActive 
          ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]" 
          : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:border-white/10 border border-transparent"
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <item.icon className={cn(
          "shrink-0 transition-transform duration-300", 
          isCollapsed ? "w-4 h-4" : "w-4 h-4 group-hover:scale-110",
          isActive && "scale-105"
      )} />
      
      <span className={cn("text-xs font-medium whitespace-nowrap transition-all duration-300", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto")}>
        {item.label}
      </span>

      {/* Indicador Ativo */}
      {isActive && (
          <div className={cn(
              "absolute bg-primary rounded-full shadow-[0_0_8px_#22c55e]",
              isCollapsed ? "top-1 right-1 w-1.5 h-1.5" : "right-2 w-1.5 h-1.5"
          )} />
      )}
    </Link>
);
