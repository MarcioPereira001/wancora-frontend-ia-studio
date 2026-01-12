'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Download, Calendar as CalendarIcon, User, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { GamificationProfile, ActivityItem, FunnelStat, DashboardKPI } from '@/types';
import { useTeam } from '@/hooks/useTeam';
import * as XLSX from 'xlsx';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Import Components
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { GamificationCard } from '@/components/dashboard/GamificationCard';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { members } = useTeam();
  const supabase = createClient();
  
  // STATE: Filtros
  const [dateRange, setDateRange] = useState({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  
  // STATE: Dados
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardKPI>({
    totalLeads: 0,
    potentialRevenue: 0,
    conversionRate: 0,
    avgTicket: 0
  });
  const [ranking, setRanking] = useState<GamificationProfile[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStat[]>([]);

  // FETCH DATA
  const fetchData = async () => {
      if (!user?.company_id) return;
      setLoading(true);

      try {
          // 1. Estatísticas Gerais (Query Direta)
          let leadQuery = supabase.from('leads')
            .select('value_potential, status, created_at, owner_id')
            .eq('company_id', user.company_id)
            .gte('created_at', `${dateRange.start}T00:00:00`)
            .lte('created_at', `${dateRange.end}T23:59:59`);

          if (selectedOwnerId !== 'all') {
              leadQuery = leadQuery.eq('owner_id', selectedOwnerId);
          } else if (user.role === 'agent') {
              leadQuery = leadQuery.eq('owner_id', user.id);
          }

          const { data: leadsData } = await leadQuery;

          if (leadsData) {
              const totalLeads = leadsData.length;
              const totalValue = leadsData.reduce((acc, curr) => acc + (Number(curr.value_potential) || 0), 0);
              // Consideramos 'won' se o status for 'won' ou se estiver numa etapa chamada 'Ganho' (simplificação)
              const wonLeads = leadsData.filter(l => l.status === 'won').length;
              const conversion = totalLeads ? ((wonLeads / totalLeads) * 100) : 0;
              const ticket = wonLeads ? (totalValue / wonLeads) : 0;

              setStats({
                  totalLeads,
                  potentialRevenue: totalValue,
                  conversionRate: parseFloat(conversion.toFixed(1)),
                  avgTicket: ticket
              });
          }

          // 2. Ranking Gamification (RPC)
          const { data: rankData } = await supabase.rpc('get_gamification_ranking', {
              p_company_id: user.company_id,
              p_start_date: `${dateRange.start}T00:00:00`,
              p_end_date: `${dateRange.end}T23:59:59`
          });
          setRanking(rankData || []);

          // 3. Atividades Recentes (RPC)
          const { data: actData } = await supabase.rpc('get_recent_activity', {
              p_company_id: user.company_id,
              p_limit: 10
          });
          setActivities(actData || []);

          // 4. Funil de Vendas (RPC)
          const funnelOwner = user.role === 'agent' ? user.id : (selectedOwnerId === 'all' ? null : selectedOwnerId);
          const { data: funnelRes } = await supabase.rpc('get_sales_funnel_stats', {
              p_company_id: user.company_id,
              p_owner_id: funnelOwner
          });
          setFunnelData(funnelRes || []);

      } catch (error) {
          console.error("Erro dashboard:", error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [user?.company_id, dateRange, selectedOwnerId]);

  // EXPORT XLSX
  const handleExport = () => {
      if(!ranking.length && !stats.totalLeads) return;
      
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: Resumo
      const summaryData = [
          { Metrica: "Faturamento Total", Valor: stats.potentialRevenue },
          { Metrica: "Total Leads", Valor: stats.totalLeads },
          { Metrica: "Conversão", Valor: `${stats.conversionRate}%` },
          { Metrica: "Ticket Médio", Valor: stats.avgTicket },
          { Periodo: `${dateRange.start} a ${dateRange.end}` }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Sheet 2: Ranking
      const wsRank = XLSX.utils.json_to_sheet(ranking);
      XLSX.utils.book_append_sheet(wb, wsRank, "Ranking Equipe");

      // Sheet 3: Funil
      const wsFunnel = XLSX.utils.json_to_sheet(funnelData);
      XLSX.utils.book_append_sheet(wb, wsFunnel, "Funil Detalhado");

      XLSX.writeFile(wb, `Wancora_Report_${dateRange.start}.xlsx`);
  };

  const myRank = ranking.find(r => r.user_id === user?.id);
  const top3 = ranking.slice(0, 3);
  const isManager = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER DE COMANDO */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Central de Comando
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">Visão tática e estratégica da operação.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Filtro de Data */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
                <CalendarIcon className="w-4 h-4 text-zinc-500" />
                <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                    className="bg-transparent text-sm text-zinc-300 outline-none w-28 md:w-32 cursor-pointer"
                />
                <span className="text-zinc-600">-</span>
                <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                    className="bg-transparent text-sm text-zinc-300 outline-none w-28 md:w-32 cursor-pointer"
                />
            </div>

            {/* Filtro de Responsável (Admin Only) */}
            {isManager && (
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select 
                        value={selectedOwnerId}
                        onChange={e => setSelectedOwnerId(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 outline-none focus:border-primary appearance-none cursor-pointer h-[42px] shadow-sm hover:bg-zinc-900 transition-colors"
                    >
                        <option value="all">Toda a Equipe</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <Button onClick={handleExport} variant="outline" className="border-zinc-700 hover:bg-zinc-800 h-[42px] gap-2">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
            </Button>
        </div>
      </div>

      {/* KPI SECTION */}
      <DashboardStats stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* COLUNA PRINCIPAL (3/4) */}
          <div className="lg:col-span-3 space-y-6">
              {/* Gráficos */}
              <SalesChart funnelData={funnelData} loading={loading} />
          </div>

          {/* COLUNA LATERAL (1/4) - Gamification & Feed */}
          <div className="space-y-6">
              {/* Meu Card */}
              {myRank && (
                  <div className="bg-zinc-900/40 border border-primary/20 rounded-xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10"><Trophy className="w-24 h-24 text-primary" /></div>
                      <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 tracking-widest">Meu Desempenho</h3>
                      <GamificationCard user={myRank} isMe={true} />
                  </div>
              )}

              {/* Ranking Top 3 */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 min-h-[300px]">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Global
                  </h3>
                  <div className="space-y-3">
                      {ranking.length === 0 ? (
                          <p className="text-zinc-500 text-sm text-center py-10">Sem dados para ranking.</p>
                      ) : (
                          top3.map((r) => (
                              <GamificationCard key={r.user_id} user={r} />
                          ))
                      )}
                  </div>
              </div>

              {/* Feed de Atividades */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase mb-4 sticky top-0 bg-zinc-900/90 py-2 backdrop-blur-sm z-10 flex justify-between items-center">
                      <span>Feed Ao Vivo</span>
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  </h3>
                  <ActivityFeed activities={activities} loading={loading} />
              </div>
          </div>
      </div>
    </div>
  );
}