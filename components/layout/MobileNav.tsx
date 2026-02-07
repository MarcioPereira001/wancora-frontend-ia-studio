
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { NAV_ITEMS } from './NavConfig';
import { cn } from '@/lib/utils';
import { Zap, Bell, LogOut, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <>
      {/* --- TOP BAR (FIXA) --- */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-800 z-50 flex items-center justify-between px-4 shadow-lg">
          <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
                  <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">Wancora</span>
          </div>

          <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="text-zinc-400 hover:text-white">
                  <Bell className="w-5 h-5" />
              </Button>
              <button onClick={() => setIsProfileMenuOpen(true)}>
                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                    {user?.avatar_url ? (
                        <img src={user.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                    )}
                </div>
              </button>
          </div>
      </header>

      {/* --- BOTTOM BAR (FIXA) --- */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-[#09090b]/95 backdrop-blur-xl border-t border-zinc-800 z-50 px-2 pb-safe">
          <div className="flex justify-between items-center h-full">
              {NAV_ITEMS.main.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                      <Link 
                          key={item.href}
                          href={item.href}
                          className={cn(
                              "flex-1 flex flex-col items-center justify-center gap-1 h-full pt-2 pb-1 transition-all active:scale-90",
                              isActive ? "text-primary" : "text-zinc-500 hover:text-zinc-300"
                          )}
                      >
                          <div className={cn("p-1.5 rounded-xl transition-all", isActive && "bg-primary/10")}>
                             <item.icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
                          </div>
                          <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
                      </Link>
                  )
              })}
          </div>
      </nav>

      {/* --- PROFILE MENU (FULLSCREEN MODAL STYLE) --- */}
      {isProfileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div 
                  className="absolute top-0 right-0 bottom-0 w-[80%] max-w-[300px] bg-[#09090b] border-l border-zinc-800 shadow-2xl p-6 animate-in slide-in-from-right duration-300 flex flex-col"
                  onClick={(e) => e.stopPropagation()} // Stop close on click inside
              >
                  {/* Header Menu */}
                  <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold text-white">Menu</h3>
                      <button onClick={() => setIsProfileMenuOpen(false)} className="p-2 bg-zinc-900 rounded-full text-zinc-400">
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  {/* Profile Card */}
                  <div className="flex items-center gap-4 mb-8 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                       <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-zinc-400">{user?.name?.charAt(0)}</span>
                            )}
                       </div>
                       <div className="overflow-hidden">
                           <p className="text-white font-medium truncate">{user?.name}</p>
                           <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                       </div>
                  </div>

                  {/* Utility Links */}
                  <div className="space-y-2 flex-1">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Aplicativos</p>
                      {NAV_ITEMS.utility.filter(i => i.label !== 'Área de Trabalho').map((item) => { // Filtra Mesa pois já está embaixo
                          const isActive = pathname === item.href;
                          return (
                              <Link 
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setIsProfileMenuOpen(false)}
                                  className={cn(
                                      "flex items-center justify-between p-3 rounded-xl transition-colors border",
                                      isActive 
                                        ? "bg-zinc-800 border-zinc-700 text-white" 
                                        : "border-transparent hover:bg-zinc-900 text-zinc-400"
                                  )}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={cn("p-2 rounded-lg", isActive ? "bg-primary/10 text-primary" : "bg-zinc-900 text-zinc-500")}>
                                          <item.icon className="w-4 h-4" />
                                      </div>
                                      <span className="text-sm font-medium">{item.label}</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                              </Link>
                          )
                      })}
                  </div>

                  {/* Logout */}
                  <Button 
                      variant="destructive" 
                      className="w-full bg-red-950/30 text-red-500 hover:bg-red-900/50 border border-red-900/50 justify-start h-12 px-4 gap-3 mt-4"
                      onClick={handleLogout}
                  >
                      <LogOut className="w-4 h-4" />
                      Sair da Conta
                  </Button>
              </div>
              
              {/* Click outside to close */}
              <div className="absolute inset-0 z-[-1]" onClick={() => setIsProfileMenuOpen(false)} />
          </div>
      )}
    </>
  );
}
