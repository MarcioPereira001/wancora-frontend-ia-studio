'use client';

import React, { useEffect, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, MessageCircle, DollarSign, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from '@/utils/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const dataMockGrafico = [
  { name: 'Seg', value: 4000, leads: 240 },
  { name: 'Ter', value: 3000, leads: 139 },
  { name: 'Qua', value: 2000, leads: 980 },
  { name: 'Qui', value: 2780, leads: 390 },
  { name: 'Sex', value: 1890, leads: 480 },
  { name: 'Sab', value: 2390, leads: 380 },
  { name: 'Dom', value: 3490, leads: 430 },
];

const StatCard = ({ title, value, change, isPositive, icon: Icon, color, loading }: any) => (
  <Card className="glass border-zinc-800 hover:border-zinc-700 transition-all duration-300">
    <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
            <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-primary' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {change}%
        </span>
        </div>
        <p className="text-zinc-400 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-white mt-1">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-zinc-600" /> : value}
        </h3>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    messagesCount: 0,
    potentialRevenue: 0,
    conversionRate: 0
  });
  const supabase = createClient();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.company_id) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Leads e Receita Potencial
        const { count: leadsCount, data: leadsData } = await supabase
          .from('leads')
          .select('value_potential, temperature', { count: 'exact' })
          .eq('company_id', user.company_id);

        const totalRevenue = leadsData?.reduce((acc, curr) => acc + (Number(curr.value_potential) || 0), 0) || 0;
        
        const hotLeads = leadsData?.filter(l => l.temperature === 'hot').length || 0;
        const conversionRateCalc = leadsCount ? ((hotLeads / leadsCount) * 100) : 0;

        // Mensagens
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', user.company_id);

        setStats({
          totalLeads: leadsCount || 0,
          messagesCount: messagesCount || 0,
          potentialRevenue: totalRevenue,
          conversionRate: parseFloat(conversionRateCalc.toFixed(1))
        });

      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase, user?.company_id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-2">Visão geral da operação da sua empresa.</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-zinc-900 border border-zinc-800 text-sm rounded-lg px-3 py-2 text-zinc-300 outline-none focus:ring-1 focus:ring-primary">
            <option>Hoje</option>
            <option>Esta semana</option>
            <option>Este mês</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Pipeline Potencial" 
          value={formatCurrency(stats.potentialRevenue)} 
          change={12.5} 
          isPositive={true} 
          icon={DollarSign} 
          color="bg-primary text-primary" 
          loading={loading}
        />
        <StatCard 
          title="Leads Totais" 
          value={stats.totalLeads} 
          change={8.2} 
          isPositive={true} 
          icon={Users} 
          color="bg-blue-500 text-blue-500" 
          loading={loading}
        />
        <StatCard 
          title="Mensagens" 
          value={stats.messagesCount.toLocaleString('pt-BR')} 
          change={5.4} 
          isPositive={true} 
          icon={MessageCircle} 
          color="bg-secondary text-secondary" 
          loading={loading}
        />
        <StatCard 
          title="Taxa de Leads Hot" 
          value={`${stats.conversionRate}%`} 
          change={2.1} 
          isPositive={false} 
          icon={Activity} 
          color="bg-orange-500 text-orange-500" 
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 glass">
          <h3 className="text-lg font-semibold text-white mb-6">Volume de Interações</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataMockGrafico}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#fafafa' }}
                />
                <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 glass">
          <h3 className="text-lg font-semibold text-white mb-6">Origem dos Leads</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataMockGrafico}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#27272a'}}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                />
                <Bar dataKey="leads" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
