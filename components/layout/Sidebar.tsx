
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
      // Fundo Cinza Chumbo (#1e1e20 é um pouco mais leve que o preto puro, dando aspecto chumbo)
      "bg-[#1e1e20]/90 backdrop-blur-md", 
      // Borda e Sombra Neon Leve
      "border-r border-white/5 shadow-[1px_0_20px_-5px_rgba(34,197,94,0.15)]",
      isCollapsed ? "w-20" : "w-64"
  );

  return (
    <aside 
        className={sidebarClasses}
        onMouseEnter={() => autoCollapseMode && setIsHovered(true)}
        onMouseLeave={() => autoCollapseMode && setIsHovered(false)}
    >
      
      {/* --- BOTÃO DE TOGGLE FLUTUANTE (MEIO) --- */}
      {/* Só aparece se o Auto Collapse estiver DESLIGADO */}
      {!autoCollapseMode && (
          <button
            onClick={() => setManualCollapsed(!manualCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 bg-[#27272a] border border-zinc-700 text-zinc-400 hover:text-white rounded-full p-1.5 shadow-lg transition-colors z-50 hover:border-primary/50 hover:shadow-primary/20"
            title={manualCollapsed ? "Expandir" : "Recolher"}
          >
            {manualCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
      )}

      {/* --- HEADER / LOGO --- */}
      <div className="h-20 flex items-center justify-center shrink-0 relative overflow-hidden">
         <div className={cn("flex items-center gap-3 transition-all duration-300", isCollapsed ? "justify-center w-full px-0" : "px-6 w-full justify-start")}>
            <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-black rounded-xl flex items-center justify-center border border-zinc-700 shadow-[0_0_10px_rgba(34,197,94,0.15)] shrink-0">
                <Zap className="w-5 h-5 text-primary fill-primary/20" />
            </div>
            <span className={cn("text-white font-bold tracking-wider text-lg transition-opacity duration-300 whitespace-nowrap", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                WANCORA
            </span>
         </div>
      </div>

      {/* --- DIVISOR --- */}
      <div className="w-full px-4 mb-2">
          <div className="h-px bg-white/5" />
      </div>

      {/* --- NAV ITEMS --- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-2">
        
        {/* MAIN SECTION */}
        {NAV_ITEMS.main.map((item) => {
             const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
             return (
                 <NavItem key={item.href} item={item} isActive={!!isActive} isCollapsed={isCollapsed} />
             );
        })}

        {/* UTILITY DIVIDER */}
        <div className={cn("py-4 flex items-center", isCollapsed ? "justify-center" : "px-2")}>
            {isCollapsed ? (
                <div className="w-4 h-px bg-zinc-800" />
            ) : (
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Ferramentas</span>
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
      <div className="p-3 border-t border-white/5 bg-black/20">
          
          <div className={cn("flex items-center gap-3 rounded-xl p-2 transition-all duration-300 mb-2", isCollapsed ? "justify-center" : "bg-white/5 border border-white/5")}>
              <div className="relative shrink-0">
                  <div className={cn("w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border overflow-hidden", user?.company_id ? "border-green-900" : "border-zinc-700")}>
                      {user?.avatar_url ? (
                          <img src={user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                          <span className="text-xs font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                      )}
                  </div>
              </div>
              
              {!isCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                      <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                  </div>
              )}
          </div>

          <div className="flex items-center justify-between gap-1">
              {/* Botão de Logout */}
              <button 
                  onClick={handleLogout}
                  className={cn(
                      "flex items-center rounded-lg transition-all duration-300 group hover:bg-red-500/10 hover:border-red-500/20 border border-transparent flex-1",
                      isCollapsed ? "w-full justify-center py-2" : "px-3 py-2 gap-3"
                  )}
                  title="Sair"
              >
                  <LogOut className={cn("shrink-0 transition-colors text-zinc-500 group-hover:text-red-400", isCollapsed ? "w-4 h-4" : "w-4 h-4")} />
                  {!isCollapsed && (
                      <span className="text-xs font-medium text-zinc-400 group-hover:text-red-400 whitespace-nowrap animate-in fade-in duration-300">
                          Sair
                      </span>
                  )}
              </button>

              {/* Botão Discreto Auto-Collapse */}
              {!isCollapsed && (
                  <button 
                    onClick={() => setAutoCollapseMode(!autoCollapseMode)}
                    className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-lg transition-colors border",
                        autoCollapseMode 
                            ? "text-primary bg-primary/10 border-primary/20" 
                            : "text-zinc-600 hover:text-zinc-400 border-transparent hover:bg-white/5"
                    )}
                    title={autoCollapseMode ? "Desativar Auto-Recolher" : "Ativar Auto-Recolher"}
                  >
                      {autoCollapseMode ? <PlayCircle size={14} className="fill-primary/20" /> : <ZapOff size={14} />}
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
        "group flex items-center rounded-xl transition-all duration-300 relative overflow-hidden",
        isCollapsed ? "w-10 h-10 justify-center mx-auto" : "w-full px-3 py-2.5 gap-3",
        isActive 
          ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]" 
          : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:border-white/10 border border-transparent"
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <item.icon className={cn(
          "shrink-0 transition-transform duration-300", 
          isCollapsed ? "w-5 h-5" : "w-5 h-5 group-hover:scale-110",
          isActive && "scale-105"
      )} />
      
      <span className={cn("text-sm font-medium whitespace-nowrap transition-all duration-300", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto")}>
        {item.label}
      </span>

      {/* Indicador Ativo */}
      {isActive && (
          <div className={cn(
              "absolute bg-primary rounded-full shadow-[0_0_8px_#22c55e]",
              isCollapsed ? "top-1 right-1 w-1.5 h-1.5" : "right-3 w-1.5 h-1.5"
          )} />
      )}
    </Link>
);
