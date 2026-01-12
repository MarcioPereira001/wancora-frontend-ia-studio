import React from 'react';
import { ArrowUpRight, ArrowDownRight, Users, MessageCircle, DollarSign, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { DashboardKPI } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface DashboardStatsProps {
  stats: DashboardKPI;
  loading: boolean;
}

const StatItem = ({ title, value, isPositive, icon: Icon, color, loading }: any) => (
  <Card className="glass-panel border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all duration-300 group">
    <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${color} bg-opacity-10 border border-white/5 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
            <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                Meta
            </span>
        </div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-white mt-1 font-mono tracking-tight">
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-zinc-700" /> : value}
        </h3>
    </CardContent>
  </Card>
);

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatItem 
            title="Receita Gerada" 
            value={formatCurrency(stats.potentialRevenue)} 
            isPositive={true} 
            icon={DollarSign} 
            color="bg-primary text-primary" 
            loading={loading}
        />
        <StatItem 
            title="Leads Ativos" 
            value={stats.totalLeads} 
            isPositive={true} 
            icon={Users} 
            color="bg-blue-500 text-blue-500" 
            loading={loading}
        />
        <StatItem 
            title="Conversão" 
            value={`${stats.conversionRate}%`} 
            isPositive={stats.conversionRate > 15} 
            icon={Activity} 
            color="bg-purple-500 text-purple-500" 
            loading={loading}
        />
        <StatItem 
            title="Ticket Médio" 
            value={formatCurrency(stats.avgTicket)} 
            isPositive={true} 
            icon={MessageCircle} 
            color="bg-orange-500 text-orange-500" 
            loading={loading}
        />
    </div>
  );
}