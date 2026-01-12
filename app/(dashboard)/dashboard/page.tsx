'use client';

import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Users, MessageCircle, DollarSign, Activity, 
  Loader2, Trophy, Medal, Download, Filter, Calendar as CalendarIcon, User
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { GamificationProfile, ActivityItem, FunnelStat } from '@/types';
import { useTeam } from '@/hooks/useTeam';
import * as XLSX from 'xlsx';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- SUB-COMPONENTES ---

const StatCard = ({ title, value, change, isPositive, icon: Icon, color, loading }: any) => (
  <Card className="glass-panel border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all duration-300">
    <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10 border border-white/5`}>
            <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        {change !== undefined && (
            <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {change}%
            </span>
        )}
        </div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-white mt-1 font-mono">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-zinc-600" /> : value}
        </h3>
    </CardContent>
  </Card>
);

const UserRankCard = ({ user, isMe = false }: { user: GamificationProfile, isMe?: boolean }) => (
    <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all relative overflow-hidden",
        isMe ? "bg-gradient-to-r from-primary/10 to-transparent border-primary/30" : "bg-zinc-900/50 border-zinc-800"
    )}>
        {/* Rank Badge */}
        <div className="relative">
            <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 shadow-lg",
                user.rank === 1 ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" :
                user.rank === 2 ? "border-zinc-400 text-zinc-400 bg-zinc-400/10" :
                user.rank === 3 ? "border-orange-700 text-orange-700 bg-orange-700/10" :
                "border-zinc-700 text-zinc-500 bg-zinc-800"
            )}>
                {user.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : user.rank <= 3 ? <Trophy className="w-6 h-6" /> : user.rank}
            </div>
            {user.rank <= 3 && (
                <div className="absolute -top-1 -right-1 bg-zinc-950 rounded-full p-0.5">
                    <Medal className={cn("w-4 h-4", 
                        user.rank === 1 ? "text-yellow-500" : 
                        user.rank === 2 ? "text-zinc-400" : "text-orange-700"
                    )} />
                </div>
            )}
        </div>

        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <h4 className={cn("font-bold truncate", isMe ? "text-primary" : "text-white")}>
                    {user.user_name} {isMe && "(Você)"}
                </h4>
                <span className="text-xs font-mono text-purple-400 font-bold">{user.xp} XP</span>
            </div>
            
            {/* XP Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 
                    style={{ width: `${Math.min((user.xp / 5000) * 100, 100)}%` }} // Meta fictícia de 5000 XP
                />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                <span>Lvl {Math.floor(user.xp / 1000) + 1}</span>
                <span>{formatCurrency(user.total_sales)}</span>
            </div>
        </div>
    </div>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { members } = useTeam();
  const supabase = createClient();
  
  // FILTROS GLOBAIS
  const [dateRange, setDateRange] = useState({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  
  // DADOS
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    potentialRevenue: 0,
    conversionRate: 0,
    avgTicket: 0
  });
  const [ranking, setRanking] = useState<GamificationProfile[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStat[]>([]);

  // Carregamento de Dados
  const fetchData = async () => {
      if (!user?.company_id) return;
      setLoading(true);

      try {
          // 1. Estatísticas Gerais (Agregadas)
          let leadQuery = supabase.from('leads')
            .select('value_potential, status, created_at')
            .eq('company_id', user.company_id)
            .gte('created_at', `${dateRange.start}T00:00:00`)
            .lte('created_at', `${dateRange.end}T23:59:59`);

          if (selectedOwnerId !== 'all') {
              leadQuery = leadQuery.eq('owner_id', selectedOwnerId);
          } else if (user.role === 'agent') {
              leadQuery = leadQuery.eq('owner_id', user.id); // Agente só vê o seu
          }

          const { data: leadsData } = await leadQuery;

          if (leadsData) {
              const totalLeads = leadsData.length;
              const totalValue = leadsData.reduce((acc, curr) => acc + (Number(curr.value_potential) || 0), 0);
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
          // Se for agente, força o ID dele. Se for admin e selecionou 'all', passa NULL.
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

  // Exportação Excel
  const handleExport = () => {
      if(!ranking.length) return;
      
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: Resumo
      const summaryData = [
          { Metrica: "Faturamento Total", Valor: stats.potentialRevenue },
          { Metrica: "Total Leads", Valor: stats.totalLeads },
          { Metrica: "Conversão", Valor: `${stats.conversionRate}%` }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Sheet 2: Ranking
      const wsRank = XLSX.utils.json_to_sheet(ranking);
      XLSX.utils.book_append_sheet(wb, wsRank, "Ranking Equipe");

      XLSX.writeFile(wb, `Wancora_Report_${dateRange.start}.xlsx`);
  };

  const myRank = ranking.find(r => r.user_id === user?.id);
  const top3 = ranking.slice(0, 3);

  const isManager = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER DE COMANDO */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Central de Comando
          </h1>
          <p className="text-zinc-400 mt-2">Visão tática e estratégica da operação.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Filtro de Data */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                <CalendarIcon className="w-4 h-4 text-zinc-500" />
                <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                    className="bg-transparent text-sm text-zinc-300 outline-none w-32"
                />
                <span className="text-zinc-600">-</span>
                <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                    className="bg-transparent text-sm text-zinc-300 outline-none w-32"
                />
            </div>

            {/* Filtro de Responsável (Admin Only) */}
            {isManager && (
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select 
                        value={selectedOwnerId}
                        onChange={e => setSelectedOwnerId(e.target.value)}
                        className="pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 outline-none focus:border-primary appearance-none cursor-pointer h-[42px]"
                    >
                        <option value="all">Toda a Equipe</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <Button onClick={handleExport} variant="outline" className="border-zinc-700 hover:bg-zinc-800 h-[42px]">
                <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
        </div>
      </div>

      {/* GAMIFICATION & KPI SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* KPI Cards (3 Cols) */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard 
                title="Receita Gerada" 
                value={formatCurrency(stats.potentialRevenue)} 
                isPositive={true} 
                icon={DollarSign} 
                color="bg-primary text-primary" 
                loading={loading}
            />
            <StatCard 
                title="Leads Totais" 
                value={stats.totalLeads} 
                isPositive={true} 
                icon={Users} 
                color="bg-blue-500 text-blue-500" 
                loading={loading}
            />
            <StatCard 
                title="Conversão" 
                value={`${stats.conversionRate}%`} 
                isPositive={stats.conversionRate > 10} 
                icon={Activity} 
                color="bg-purple-500 text-purple-500" 
                loading={loading}
            />
            <StatCard 
                title="Ticket Médio" 
                value={formatCurrency(stats.avgTicket)} 
                isPositive={true} 
                icon={MessageCircle} 
                color="bg-orange-500 text-orange-500" 
                loading={loading}
            />

            {/* GRÁFICO PRINCIPAL */}
            <div className="md:col-span-2 xl:col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 h-[400px]">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary" /> Funil de Vendas
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" stroke="#71717a" fontSize={12} hide />
                        <YAxis dataKey="stage_name" type="category" stroke="#a1a1aa" fontSize={11} width={100} />
                        <Tooltip 
                            cursor={{fill: '#27272a'}}
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`${value} Leads`, 'Quantidade']}
                        />
                        <Bar dataKey="lead_count" radius={[0, 4, 4, 0]} barSize={32}>
                            {funnelData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* GAMIFICATION SIDEBAR (1 Col) */}
          <div className="space-y-6">
              {/* Meu Card */}
              {myRank && (
                  <div className="bg-zinc-900/40 border border-primary/20 rounded-xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10"><Trophy className="w-24 h-24 text-primary" /></div>
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-3">Meu Desempenho</h3>
                      <UserRankCard user={myRank} isMe={true} />
                  </div>
              )}

              {/* Top 3 */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 min-h-[400px]">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Global
                  </h3>
                  <div className="space-y-3">
                      {ranking.length === 0 ? (
                          <p className="text-zinc-500 text-sm text-center py-10">Sem dados para ranking.</p>
                      ) : (
                          top3.map((r) => (
                              <UserRankCard key={r.user_id} user={r} />
                          ))
                      )}
                  </div>
              </div>

              {/* Feed de Atividades */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase mb-4 sticky top-0 bg-zinc-900/90 py-2 backdrop-blur-sm">Feed Ao Vivo</h3>
                  <div className="space-y-4">
                      {activities.map((act) => (
                          <div key={act.id + act.type} className="flex gap-3 items-start border-l-2 border-zinc-800 pl-3 py-1 hover:border-primary transition-colors">
                              <div className="flex-1">
                                  <p className="text-sm text-zinc-200 font-medium">{act.title}</p>
                                  <p className="text-xs text-zinc-500 truncate">{act.description}</p>
                                  <span className="text-[10px] text-zinc-600 block mt-1">
                                      {format(new Date(act.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                                  </span>
                              </div>
                          </div>
                      ))}
                      {activities.length === 0 && <p className="text-zinc-600 text-xs italic">Nenhuma atividade recente.</p>}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}