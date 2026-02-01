'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Plus, Rocket, Calendar, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  target_tags: string[];
  message_template: string;
}

export default function CampaignsListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) return;

    const fetchCampaigns = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCampaigns(data || []);
      } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [user?.company_id, supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded-full text-xs border border-green-500/20"><CheckCircle2 size={12} /> Concluído</span>;
      case 'processing':
        return <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full text-xs border border-blue-500/20"><Loader2 size={12} className="animate-spin" /> Enviando</span>;
      case 'failed':
        return <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded-full text-xs border border-red-500/20"><AlertCircle size={12} /> Falha</span>;
      default:
        return <span className="flex items-center gap-1 text-zinc-400 bg-zinc-800 px-2 py-1 rounded-full text-xs border border-zinc-700"><Clock size={12} /> Pendente</span>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date).replace('.', '');
    } catch (e) {
        return dateString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Rocket className="w-8 h-8 text-primary" />
            Campanhas
          </h1>
          <p className="text-zinc-400 mt-1">Histórico de disparos em massa e automações.</p>
        </div>
        <Button onClick={() => router.push('/campaigns/new')} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]">
          <Plus className="w-4 h-4 mr-2" /> Nova Campanha
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : campaigns.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                <Rocket className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-zinc-300 font-medium">Nenhuma campanha encontrada</h3>
                <p className="text-zinc-500 text-sm mb-6">Crie seu primeiro disparo em massa agora.</p>
                <Button variant="outline" onClick={() => router.push('/campaigns/new')}>Criar Campanha</Button>
            </div>
        ) : (
            campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition-all flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-white">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2 max-w-2xl font-mono bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                            {campaign.message_template}
                        </p>
                        <div className="flex gap-2 mt-2">
                            {campaign.target_tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col items-end justify-center min-w-[150px] gap-2">
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                            <Calendar size={14} />
                            {formatDate(campaign.created_at)}
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white" disabled>
                            Ver Relatório (Em breve)
                        </Button>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}