'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NAV_ITEMS } from './NavConfig';
import { cn } from '@/lib/utils';
import { LogOut, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  
  // Estado de Colapso (Padrão recolhido para ser menos intrusivo inicialmente)
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const sidebarClasses = cn(
      "hidden lg:flex flex-col h-screen sticky top-0 border-r border-zinc-800 bg-[#18181b]/80 backdrop-blur-xl transition-all duration-300 ease-in-out z-40 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.3)]",
      isCollapsed ? "w-20" : "w-64"
  );

  return (
    <aside className={sidebarClasses}>
      
      {/* --- BOTÃO DE TOGGLE FLUTUANTE --- */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-9 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white rounded-full p-1 shadow-lg transition-colors z-50 hover:border-primary/50"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* --- HEADER / LOGO --- */}
      <div className="h-20 flex items-center justify-center shrink-0 relative">
         <div className={cn("flex items-center gap-3 transition-all duration-300", isCollapsed ? "justify-center" : "px-6 w-full justify-start")}>
            <div className="w-10 h-10 bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center border border-zinc-800 shadow-[0_0_15px_rgba(34,197,94,0.2)] shrink-0">
                <Zap className="w-5 h-5 text-primary fill-primary/20" />
            </div>
            {!isCollapsed && (
                <span className="text-white font-bold tracking-wider text-lg animate-in fade-in duration-300 whitespace-nowrap">
                    WANCORA
                </span>
            )}
         </div>
      </div>

      {/* --- DIVISOR --- */}
      <div className="w-full px-4 mb-2">
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
      </div>

      {/* --- NAV ITEMS --- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2 px-3 space-y-1">
        
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
                <div className="w-4 h-px bg-zinc-800" />
            ) : (
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Ferramentas</span>
            )}
        </div>

        {/* UTILITY SECTION */}
        {NAV_ITEMS.utility.filter(i => i.label !== 'Área de Trabalho').map((item) => { 
             const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
             return (
                 <NavItem key={item.href} item={item} isActive={!!isActive} isCollapsed={isCollapsed} />
             );
        })}

      </div>

      {/* --- FOOTER / USER --- */}
      <div className="p-3 border-t border-zinc-800 bg-[#09090b]/30">
          
          <div className={cn("flex items-center gap-3 rounded-xl p-2 transition-all duration-300", isCollapsed ? "justify-center" : "bg-zinc-900/50 border border-zinc-800")}>
              <div className="relative shrink-0">
                  <div className={cn("w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border overflow-hidden", user?.company_id ? "border-green-500/50" : "border-zinc-700")}>
                      {user?.avatar_url ? (
                          <img src={user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                          <span className="text-xs font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                      )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black" />
              </div>
              
              {!isCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                      <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                  </div>
              )}
          </div>

          <button 
              onClick={handleLogout}
              className={cn(
                  "mt-2 flex items-center rounded-lg transition-all duration-300 group hover:bg-red-500/10 hover:border-red-500/20 border border-transparent",
                  isCollapsed ? "w-10 h-10 justify-center mx-auto" : "w-full px-3 py-2 gap-3"
              )}
              title="Sair"
          >
              <LogOut className={cn("shrink-0 transition-colors text-zinc-500 group-hover:text-red-400", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!isCollapsed && (
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-red-400 whitespace-nowrap animate-in fade-in duration-300">
                      Encerrar Sessão
                  </span>
              )}
          </button>
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
      
      {!isCollapsed && (
          <span className="text-sm font-medium whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
            {item.label}
          </span>
      )}

      {/* Indicador Ativo (Bolinha ou Barra) */}
      {isActive && (
          <div className={cn(
              "absolute bg-primary rounded-full shadow-[0_0_8px_#22c55e]",
              isCollapsed ? "top-1 right-1 w-1.5 h-1.5" : "right-3 w-1.5 h-1.5"
          )} />
      )}
    </Link>
);