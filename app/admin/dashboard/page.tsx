
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Server, Database, AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';
import { LogViewer } from '@/components/admin/LogViewer';
import { SystemHealth } from '@/components/admin/SystemHealth'; // NOVO
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
      totalErrors: 0,
      activeSessions: 0,
      dbStatus: 'Online',
      uptime: '99.9%'
  });

  useEffect(() => {
      // Busca estatísticas rápidas
      const fetchStats = async () => {
          const today = new Date().toISOString().split('T')[0];
          
          // Conta erros de hoje
          const { count } = await supabase
              .from('system_logs')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', today)
              .in('level', ['error', 'fatal']);

          // Conta sessões ativas
          const { count: sessions } = await supabase
              .from('instances')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'connected');

          setStats({
              totalErrors: count || 0,
              activeSessions: sessions || 0,
              dbStatus: 'Online',
              uptime: '100%'
          });
      };

      fetchStats();
      const interval = setInterval(fetchStats, 60000); // Atualiza stats a cada minuto
      return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Activity className="w-8 h-8 text-red-600" />
                    Wancora <span className="text-red-600">Matrix</span>
                </h1>
                <p className="text-zinc-400 mt-1 text-sm">Centro de Comando e Observabilidade do Sistema.</p>
            </div>
            <div className="flex items-center gap-3">
                <Link href="/admin/settings">
                    <Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                        Configurações Globais
                    </Button>
                </Link>
                <span className="flex items-center gap-2 px-3 py-1 bg-green-900/20 border border-green-900/50 rounded-full text-green-500 text-xs font-bold animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    SISTEMA OPERACIONAL
                </span>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Esquerda: KPIs */}
            <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-fit">
                <Card className="bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Erros (Hoje)</CardTitle>
                        <AlertTriangle className={stats.totalErrors > 0 ? "h-4 w-4 text-red-500" : "h-4 w-4 text-green-500"} />
                    </CardHeader>
                    <CardContent>
                        <div className={stats.totalErrors > 0 ? "text-2xl font-bold text-red-500" : "text-2xl font-bold text-white"}>
                            {stats.totalErrors}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Exceções críticas capturadas</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sessões Ativas</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.activeSessions}</div>
                        <p className="text-xs text-zinc-500 mt-1">Instâncias Baileys conectadas</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Banco de Dados</CardTitle>
                        <Database className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.dbStatus}</div>
                        <p className="text-xs text-zinc-500 mt-1">Supabase Pool</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Backend CPU</CardTitle>
                        <Cpu className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">12%</div>
                        <p className="text-xs text-zinc-500 mt-1">Carga média do cluster</p>
                    </CardContent>
                </Card>
            </div>

            {/* Direita: Health Monitor */}
            <div className="xl:col-span-1">
                <Card className="bg-black/50 border-zinc-800 h-full">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-zinc-300">Latência em Tempo Real</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SystemHealth />
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* LOG VIEWER */}
        <div className="space-y-2 pt-4">
            <h3 className="text-lg font-bold text-zinc-300 pl-1">Console do Sistema</h3>
            <LogViewer />
        </div>
    </div>
  );
}
