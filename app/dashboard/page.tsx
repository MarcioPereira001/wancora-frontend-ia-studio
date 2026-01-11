'use client';

import React, { useEffect, useState } from 'react';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { useAuthStore } from '@/store/useAuthStore';
import { Users, Send, TrendingUp, Activity, Calendar, Zap, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [stats, setStats] = useState({
      leads: 0,
      messages: 0,
      revenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      if(!user?.company_id) return;

      const fetchData = async () => {
          setLoading(true);
          try {
             const { count: leadsCount, data: leadsData } = await supabase.from('leads').select('value_potential', { count: 'exact' }).eq('company_id', user.company_id);
             const { count: msgCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('company_id', user.company_id);
             
             const totalRevenue = leadsData?.reduce((acc, curr) => acc + (curr.value_potential || 0), 0) || 0;

             setStats({
                 leads: leadsCount || 0,
                 messages: msgCount || 0,
                 revenue: totalRevenue
             });
          } catch(e) {
              console.error(e);
          } finally {
              setLoading(false);
          }
      };
      fetchData();
  }, [user?.company_id]);

  const cards = [
    { label: 'Total de Leads', value: stats.leads, icon: Users, color: 'text-green-500', border: 'border-green-500/20' },
    { label: 'Mensagens Hoje', value: stats.messages, icon: Send, color: 'text-cyan-400', border: 'border-cyan-500/20' },
    { label: 'Pipeline Potencial', value: formatCurrency(stats.revenue), icon: TrendingUp, color: 'text-purple-500', border: 'border-purple-500/20' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          Dashboard <span className="text-green-500">.</span>
        </h1>
        <p className="text-zinc-400 text-sm">
          Painel de Controle Wancora CRM.
        </p>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((stat) => (
          <div 
            key={stat.label} 
            className={`glass-panel p-6 rounded-2xl relative overflow-hidden group transition-all hover:border-opacity-50 ${stat.border}`}
          >
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-4xl font-bold text-white mt-2 tracking-tighter tabular-nums">
                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-zinc-700" /> : stat.value}
                </h3>
              </div>
              <div className={`p-3 rounded-xl bg-zinc-900/50 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            {/* Efeito de fundo */}
            <div className={`absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500`}>
              <stat.icon size={120} className={stat.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal (2/3) - Conexão WhatsApp */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-500" />
              Central de Conexão
            </h2>
            {/* Componente Crítico com Status Real */}
            <div className="glass-panel rounded-2xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium mb-1">Status da Instância</h3>
                        <p className="text-sm text-zinc-500">Monitore sua conexão com a API do Baileys.</p>
                    </div>
                    <ConnectionStatus /> 
                </div>
            </div>
          </section>
        </div>
        
        {/* Coluna Lateral (1/3) - Atividade e Atalhos */}
        <div className="lg:col-span-1 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-500" />
              Atividade Recente
            </h2>
            <div className="glass-panel rounded-2xl p-6 h-[200px] flex flex-col items-center justify-center text-center space-y-4 border border-zinc-800">
               <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center animate-pulse">
                  <Activity className="text-zinc-700 w-6 h-6" />
               </div>
               <p className="text-zinc-500 text-xs px-4">
                 Sincronizando eventos do sistema...
               </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Próximos Agendamentos
            </h2>
            <div className="glass-panel rounded-2xl p-6 h-[150px] flex flex-col items-center justify-center text-center border border-zinc-800 opacity-60">
               <p className="text-zinc-600 text-sm">Módulo Agenda (Em breve)</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}