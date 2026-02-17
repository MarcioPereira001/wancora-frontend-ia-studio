
'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Brain, Database, Zap, Settings, ShieldCheck, FileText, PhoneCall, Calendar, Cloud, Clock, AlignCenter, MessageSquare, ListFilter, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentTriggerConfig } from '@/types';

// --- BASE NODE WRAPPER (Visual Upgrade) ---
const NodeWrapper = ({ children, colorClass, selected, title, icon: Icon }: any) => {
    // Mapa de cores Tailwind para Neon Glow
    const colors: Record<string, string> = {
        green: "border-green-500/50 shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]",
        purple: "border-purple-500/50 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]",
        orange: "border-orange-500/50 shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]",
        blue: "border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.4)]",
        pink: "border-pink-500/50 shadow-[0_0_20px_-5px_rgba(236,72,153,0.4)]",
        red: "border-red-500/50 shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)]"
    };

    const bgColors: Record<string, string> = {
        green: "bg-green-500/10 text-green-400",
        purple: "bg-purple-500/10 text-purple-400",
        orange: "bg-orange-500/10 text-orange-400",
        blue: "bg-blue-500/10 text-blue-400",
        pink: "bg-pink-500/10 text-pink-400",
        red: "bg-red-500/10 text-red-400"
    };

    return (
        <div className={cn(
            "min-w-[240px] rounded-xl border-2 transition-all duration-300 backdrop-blur-xl bg-[#09090b]/90 group",
            selected ? colors[colorClass] : "border-zinc-800 hover:border-zinc-700"
        )}>
            {/* Header do Nó */}
            <div className={cn("px-4 py-2 border-b border-zinc-800/50 flex items-center gap-3 rounded-t-xl", bgColors[colorClass])}>
                <Icon className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
            </div>
            
            {/* Corpo do Nó */}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

// --- CUSTOM HANDLES ---
const SourceHandle = () => (
    <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-zinc-900 transition-colors hover:!bg-primary hover:!scale-125" 
    />
);

const TargetHandle = () => (
    <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-zinc-600 !border-2 !border-zinc-900 !rounded-none" 
    />
);

// --- 1. START NODE ---
export const StartNode = memo(({ data, selected }: NodeProps) => {
  const trigger = (data.trigger as AgentTriggerConfig) || { type: 'all_messages' };
  
  let label = "Qualquer Mensagem";
  let subLabel = "Se nenhum outro ativar";

  switch(trigger.type) {
      case 'first_message_day': label = "1ª do Dia"; subLabel = "Janela de 24h"; break;
      case 'first_message_ever': label = "Boas Vindas"; subLabel = "Nunca interagiu antes"; break;
      case 'keyword_exact': label = "Palavra Exata"; subLabel = `"${trigger.keywords?.[0] || '...'}"`; break;
      case 'keyword_contains': label = "Contém Palavra"; subLabel = `"${trigger.keywords?.[0] || '...'}"`; break;
      case 'pipeline_stage': label = "Fase do Funil"; subLabel = "Movimentação de Card"; break;
  }

  return (
    <div className={cn("relative", selected ? "scale-105 transition-transform" : "")}>
        <NodeWrapper selected={selected} colorClass="green" title="Gatilho Inicial" icon={Zap}>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-100">{label}</span>
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900/50 px-2 py-1 rounded border border-zinc-800/50 w-fit">
                    {subLabel}
                </span>
            </div>
            <SourceHandle />
        </NodeWrapper>
        {/* Efeito de Pulso para indicar Início */}
        <div className="absolute -inset-1 bg-green-500/20 blur-lg -z-10 rounded-full animate-pulse pointer-events-none" />
    </div>
  );
});
StartNode.displayName = 'StartNode';

// --- 2. PERSONALITY NODE ---
export const PersonalityNode = memo(({ data, selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="purple" title="Personalidade" icon={Bot}>
      <TargetHandle />
      <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">Papel:</span>
              <span className="text-zinc-200 font-medium truncate max-w-[120px]">{data.role ? String(data.role) : 'Indefinido'}</span>
          </div>
          {data.tone && (
              <div className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 truncate">
                  Tom: {data.tone}
              </div>
          )}
      </div>
      <SourceHandle />
    </NodeWrapper>
  );
});
PersonalityNode.displayName = 'PersonalityNode';

// --- 3. KNOWLEDGE NODE ---
export const KnowledgeNode = memo(({ data, selected }: NodeProps) => {
  const fileCount = (data.files as any[])?.length || 0;
  return (
    <NodeWrapper selected={selected} colorClass="orange" title="Conhecimento" icon={Database}>
      <TargetHandle />
      <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-orange-500 font-mono">{fileCount}</div>
          <div className="flex flex-col">
              <span className="text-xs text-zinc-300">Arquivos</span>
              <span className="text-[10px] text-zinc-500">Indexados</span>
          </div>
      </div>
      <SourceHandle />
    </NodeWrapper>
  );
});
KnowledgeNode.displayName = 'KnowledgeNode';

// --- 4. SPECIALIST NODE ---
export const SpecialistNode = memo(({ data, selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="blue" title="Especialista" icon={Brain}>
      <TargetHandle />
      <div className="space-y-2">
          <div className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
              {data.instruction ? `"${data.instruction}"` : "Sem instruções específicas."}
          </div>
          {data.technique && (
              <span className="text-[9px] uppercase font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {data.technique}
              </span>
          )}
      </div>
      <SourceHandle />
    </NodeWrapper>
  );
});
SpecialistNode.displayName = 'SpecialistNode';

// --- 5. TOOL NODE ---
export const ToolNode = memo(({ data, selected }: NodeProps) => {
  const toolType = data.toolType as string;
  let label = "Integração";
  let statusColor = "text-zinc-500";
  
  if (toolType === 'calendar') { label = "Agenda"; statusColor = "text-green-400"; }
  else if (toolType === 'crm') { label = "CRM"; statusColor = "text-blue-400"; }
  else if (toolType === 'files') { label = "Google Drive"; statusColor = "text-orange-400"; }

  return (
    <NodeWrapper selected={selected} colorClass="pink" title="Ferramenta" icon={Settings}>
      <TargetHandle />
      <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">{label}</span>
          <div className={cn("w-2 h-2 rounded-full animate-pulse", statusColor.replace('text-', 'bg-'))} />
      </div>
      {data.drive_folder_id && <p className="text-[9px] text-zinc-500 mt-1 truncate">Pasta ID: {data.drive_folder_id}</p>}
      <SourceHandle />
    </NodeWrapper>
  );
});
ToolNode.displayName = 'ToolNode';

// --- 6. GUARD NODE ---
export const GuardNode = memo(({ data, selected }: NodeProps) => {
  const rulesCount = (data.negative_prompts?.length || 0) + (data.escape_rules?.length || 0);
  return (
    <NodeWrapper selected={selected} colorClass="red" title="Segurança" icon={ShieldCheck}>
      <TargetHandle />
      <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300">Regras Ativas:</span>
          <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{rulesCount}</span>
      </div>
      <SourceHandle />
    </NodeWrapper>
  );
});
GuardNode.displayName = 'GuardNode';
