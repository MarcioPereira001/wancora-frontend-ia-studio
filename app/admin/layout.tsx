
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Activity, Users, Home, LogOut } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Verifica Sessão
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
      redirect('/auth/login-admin');
  }

  // 2. Verifica Flag Super Admin (Segurança Real)
  const { data: profile } = await supabase
      .from('profiles')
      .select('super_admin')
      .eq('id', session.user.id)
      .single();

  if (!profile?.super_admin) {
      // Se não for admin, chuta pro dashboard normal
      redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-mono">
        {/* Admin Header */}
        <header className="h-14 border-b border-red-900/20 bg-zinc-950 flex items-center justify-between px-6 sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <div className="bg-red-900/20 p-1.5 rounded border border-red-900/30">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <span className="font-bold text-zinc-300 tracking-wider text-sm">WANCORA <span className="text-red-500">GOD MODE</span></span>
            </div>
            
            <nav className="flex items-center gap-6 text-xs font-bold text-zinc-500">
                <Link href="/admin/dashboard" className="hover:text-red-400 transition-colors flex items-center gap-2">
                    <Activity className="w-4 h-4" /> MONITOR
                </Link>
                <Link href="/admin/users" className="hover:text-red-400 transition-colors flex items-center gap-2">
                    <Users className="w-4 h-4" /> CLIENTES
                </Link>
                <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-2 border-l border-zinc-800 pl-6">
                    <Home className="w-4 h-4" /> APP
                </Link>
            </nav>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
            {children}
        </main>
    </div>
  );
}
