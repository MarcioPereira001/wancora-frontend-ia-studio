
import React, { useState } from 'react';
import { Lead, PipelineStage } from '@/types';
import { useTeam } from '@/hooks/useTeam';
import { formatCurrency, cn, formatPhone } from '@/lib/utils';
import { Search, User, Filter, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LeadDetailsModal } from './LeadDetailsModal';

interface LeadListViewProps {
  leads: Lead[];
  stages: PipelineStage[];
}

export function LeadListView({ leads, stages }: LeadListViewProps) {
  const { members } = useTeam();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Filtering (Safe for NULLs)
  const filteredLeads = leads.filter(lead => {
      const searchLower = searchTerm.toLowerCase();
      // Proteção contra nome nulo
      const nameMatch = (lead.name || '').toLowerCase().includes(searchLower);
      const phoneMatch = (lead.phone || '').includes(searchLower);
      const tagsMatch = lead.tags?.some(t => t.toLowerCase().includes(searchLower));
      
      return nameMatch || phoneMatch || tagsMatch;
  });

  const getStageName = (stageId: string) => {
      const stage = stages.find(s => s.id === stageId);
      return stage ? { name: stage.name, color: stage.color } : { name: 'Sem Etapa', color: '#71717a' };
  };

  const getOwnerName = (ownerId?: string) => {
      const member = members.find(m => m.id === ownerId);
      return member ? member.name : 'Sem dono';
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/20 border border-zinc-800 rounded-xl overflow-hidden animate-in fade-in">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
            <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar lista geral..."
                    className="pl-9 h-9 text-sm bg-zinc-950 border-zinc-800"
                />
            </div>
            <div className="text-xs text-zinc-500">
                Exibindo {filteredLeads.length} leads
            </div>
        </div>

        {/* Table Header */}
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                        <th className="px-4 py-3 font-medium border-b border-zinc-800 w-[30%]">Lead / Contato</th>
                        <th className="px-4 py-3 font-medium border-b border-zinc-800 w-[15%]">Valor</th>
                        <th className="px-4 py-3 font-medium border-b border-zinc-800 w-[20%]">Etapa Atual</th>
                        <th className="px-4 py-3 font-medium border-b border-zinc-800 w-[20%]">Responsável</th>
                        <th className="px-4 py-3 font-medium border-b border-zinc-800 w-[15%]">Criado em</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {filteredLeads.map((lead) => {
                        const stageInfo = getStageName(lead.pipeline_stage_id);
                        const ownerName = getOwnerName(lead.owner_id);
                        
                        // LÓGICA DE EXIBIÇÃO: Se nome nulo, usa telefone formatado
                        const displayName = lead.name || formatPhone(lead.phone) || 'Sem Nome';
                        const displayInitial = (displayName || '?').charAt(0).toUpperCase();

                        return (
                            <tr 
                                key={lead.id} 
                                onClick={() => setSelectedLead(lead)}
                                className="group hover:bg-zinc-800/30 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 border border-zinc-700">
                                            {lead.profile_pic_url ? (
                                                <img src={lead.profile_pic_url} className="w-full h-full rounded-full object-cover" />
                                            ) : displayInitial}
                                        </div>
                                        <div>
                                            <div className="font-medium text-zinc-200 group-hover:text-primary transition-colors">{displayName}</div>
                                            <div className="text-xs text-zinc-500">{lead.phone}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-zinc-300">
                                    {formatCurrency(lead.value_potential || 0)}
                                </td>
                                <td className="px-4 py-3">
                                    <span 
                                        className="px-2 py-1 rounded text-[10px] uppercase font-bold border border-opacity-30 inline-flex items-center gap-1.5"
                                        style={{ 
                                            backgroundColor: `${stageInfo.color}15`, 
                                            color: stageInfo.color,
                                            borderColor: stageInfo.color 
                                        }}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageInfo.color }} />
                                        {stageInfo.name}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <User className="w-3 h-3" />
                                        <span>{ownerName}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-zinc-500 text-xs">
                                    {new Date(lead.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        );
                    })}
                    {filteredLeads.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-12 text-zinc-500">
                                Nenhum lead encontrado nesta visualização.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <LeadDetailsModal 
            lead={selectedLead} 
            isOpen={!!selectedLead} 
            onClose={() => setSelectedLead(null)} 
        />
    </div>
  );
}
