
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Send, 
  Bot, 
  QrCode, 
  Settings, 
  LogOut, 
  X,
  Zap,
  Calendar,
  Monitor // Ícone alterado para Monitor (Desktop)
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  onClose?: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'CRM Kanban', href: '/crm' },
  { icon: MessageSquare, label: 'Chat Inbox', href: '/chat' },
  { icon: Send, label: 'Campanhas', href: '/campaigns' },
  { icon: Bot, label: 'Agentes IA', href: '/agents' },
  { icon: Calendar, label: 'Agenda', href: '/calendar' },
  { icon: Monitor, label: 'Área de Trabalho', href: '/cloud' }, // Renomeado
  { icon: QrCode, label: 'Conexões', href: '/connections' },
  { icon: Settings, label: 'Configurações', href: '/settings' },
];

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const userName = user?.name || 'Usuário';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full w-64 bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Wancora</span>
        </div>
        <button onClick={onClose} className="md:hidden text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-zinc-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User / Footer */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700 overflow-hidden">
            {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : userInitial}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 border-zinc-800 bg-zinc-900/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-zinc-400"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
