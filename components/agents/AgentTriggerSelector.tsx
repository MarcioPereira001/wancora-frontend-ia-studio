
'use client';

import React from 'react';
import { AgentTriggerConfig, AgentTriggerType, PipelineStage } from '@/types';
import { TagInput } from '@/components/ui/tag-input';
import { Zap, AlignCenter, Clock, Database, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentTriggerSelectorProps {
  value: AgentTriggerConfig;
  onChange: (config: AgentTriggerConfig) => void;
  stages: PipelineStage[];
}

const TRIGGER_TYPES: { id: AgentTriggerType; label: string; icon: any; desc: string }[] = [
  { id: 'all_messages', label: 'Qualquer Mensagem', icon: MessageSquare, desc: 'Responde a tudo (se nenhum outro gatilho disparar).' },
  { id: 'first_message_day', label: 'Primeira do Dia', icon: Clock, desc: 'Apenas na primeira interação do lead nas últimas 24h.' },
  { id: 'first_message_ever', label: 'Primeira da Vida (Boas Vindas)', icon: Zap, desc: 'Apenas se o lead nunca tiver falado antes.' },
  { id: 'keyword_exact', label: 'Palavra-Chave Exata', icon: AlignCenter, desc: 'Se a mensagem for exatamente uma das palavras.' },
  { id: 'keyword_contains', label: 'Contém Palavra-Chave', icon: AlignCenter, desc: 'Se a mensagem contiver uma das palavras.' },
  { id: 'pipeline_stage', label: 'Etapa do Funil', icon: Database, desc: 'Apenas leads que estão em uma etapa específica.' },
];

export function AgentTriggerSelector({ value, onChange, stages }: AgentTriggerSelectorProps) {
  
  const handleTypeChange = (newType: AgentTriggerType) => {
    // Preserva dados existentes se fizer sentido, senão reseta
    onChange({
      ...value,
      type: newType,
      keywords: (newType.includes('keyword') ? value.keywords : []),
      stage_id: (newType === 'pipeline_stage' ? value.stage_id : undefined)
    });
  };

  return (
    <div className="space-y-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Quando este agente deve ativar?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TRIGGER_TYPES.map((t) => (
                <button
                    key={t.id}
                    onClick={() => handleTypeChange(t.id)}
                    className={cn(
                        "flex flex-col items-start p-3 rounded-lg border text-left transition-all hover:bg-zinc-800",
                        value.type === t.id 
                            ? "bg-green-500/10 border-green-500/50" 
                            : "bg-zinc-950 border-zinc-800"
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <t.icon className={cn("w-4 h-4", value.type === t.id ? "text-green-500" : "text-zinc-500")} />
                        <span className={cn("text-sm font-bold", value.type === t.id ? "text-white" : "text-zinc-300")}>
                            {t.label}
                        </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 leading-tight">{t.desc}</span>
                </button>
            ))}
        </div>
      </div>

      {/* Inputs Condicionais */}
      {(value.type === 'keyword_exact' || value.type === 'keyword_contains') && (
          <div className="animate-in fade-in slide-in-from-top-2">
              <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                  <AlignCenter className="w-3 h-3" /> Palavras-Chave
              </label>
              <TagInput 
                  tags={value.keywords || []}
                  onChange={(tags) => onChange({ ...value, keywords: tags })}
                  placeholder="Digite a palavra e tecle Enter..."
              />
              <p className="text-[10px] text-zinc-600 mt-2">
                  {value.type === 'keyword_exact' 
                      ? 'O agente só ativará se a mensagem do cliente for IDÊNTICA a uma dessas palavras.' 
                      : 'O agente ativará se a mensagem contiver qualquer uma dessas palavras.'}
              </p>
          </div>
      )}

      {value.type === 'pipeline_stage' && (
          <div className="animate-in fade-in slide-in-from-top-2">
               <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2">
                  <Database className="w-3 h-3" /> Selecione a Etapa
              </label>
              <select 
                  value={value.stage_id || ''}
                  onChange={(e) => onChange({ ...value, stage_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-green-500"
              >
                  <option value="">Selecione uma etapa...</option>
                  {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
          </div>
      )}
    </div>
  );
}
