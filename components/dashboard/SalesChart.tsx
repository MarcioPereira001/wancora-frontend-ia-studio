import React from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { FunnelStat } from '@/types';
import { Filter, TrendingUp, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SalesChartProps {
  funnelData: FunnelStat[];
  revenueData?: any[]; // Dados temporais para o AreaChart
  loading: boolean;
}

export function SalesChart({ funnelData, revenueData = [], loading }: SalesChartProps) {
  
  if (loading) {
      return (
          <div className="h-[400px] w-full bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
      );
  }

  // Se não tiver dados suficientes, mostra placeholder
  if (funnelData.length === 0) {
      return (
          <div className="h-[400px] w-full bg-zinc-900/40 border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-500">
              <Filter className="w-12 h-12 mb-4 opacity-20" />
              <p>Sem dados no funil para este período.</p>
          </div>
      );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 1: FUNIL DE VENDAS */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 h-[400px] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20"></div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" /> Funil de Conversão
            </h3>
            <ResponsiveContainer width="100%" height="85%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={(val) => val.toString()} />
                    <YAxis 
                        dataKey="stage_name" 
                        type="category" 
                        stroke="#a1a1aa" 
                        fontSize={11} 
                        width={100}
                        tick={{fill: '#a1a1aa'}}
                    />
                    <Tooltip 
                        cursor={{fill: '#27272a'}}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number) => [`${value} Leads`, 'Volume']}
                    />
                    <Bar dataKey="lead_count" radius={[0, 4, 4, 0]} barSize={24}>
                        {funnelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>

        {/* GRÁFICO 2: EVOLUÇÃO DE VALOR DO PIPELINE */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 h-[400px]">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" /> Valor em Potencial
            </h3>
            <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={funnelData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="stage_name" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} tickFormatter={(val) => `R$${val/1000}k`} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
                    />
                    <Area type="monotone" dataKey="total_value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
}