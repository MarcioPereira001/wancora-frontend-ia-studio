'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Users, Settings, Zap, QrCode, Bot, Send, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'CRM Kanban', href: '/crm' },
  { icon: MessageSquare, label: 'Chat Inbox', href: '/chat' },
  { icon: Send, label: 'Campanhas', href: '/campaigns/new' },
  { icon: Bot, label: 'Agentes IA', href: '/agents' },
  { icon: QrCode, label: 'Conexões', href: '/connections' },
  { icon: Settings, label: 'Configurações', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const supabase = createClient();

  if (pathname?.startsWith("/auth")) return null;

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      router.push('/auth/login');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-zinc-950/95 backdrop-blur-xl flex flex-col justify-between">
      <div>
        <div className="flex h-16 items-center border-b border-border px-6">
            <Zap className="mr-2 h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-white">Wancora CRM</span>
        </div>

        <div className="flex flex-col gap-1 p-4">
            {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href) || (item.href === '/campaigns/new' && pathname.startsWith('/campaigns'));
            return (
                <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                    isActive 
                    ? "bg-primary/10 text-primary shadow-[0_0_10px_rgba(34,197,94,0.1)] border border-primary/20" 
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                )}
                >
                <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-zinc-500 group-hover:text-white")} />
                {item.label}
                </Link>
            );
            })}
        </div>
      </div>

      <div className="border-t border-border p-4 bg-zinc-900/30">
        <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white border border-zinc-700">
                {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-white truncate">{user?.name || 'Carregando...'}</span>
                <span className="text-[10px] text-zinc-500 truncate">{user?.email}</span>
            </div>
        </div>
        <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 transition-colors"
        >
            <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}