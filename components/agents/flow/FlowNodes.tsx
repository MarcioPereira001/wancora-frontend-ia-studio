
'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Brain, Database, Zap, Settings, ShieldCheck, FileText, PhoneCall, Calendar, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- BASE NODE WRAPPER ---
const NodeWrapper = ({ children, colorClass, selected }: any) => (
  <div className={cn(
    "px-4 py-3 rounded-lg border-2 bg-zinc-950 min-w-[200px] transition-all",
    selected ? `border-${colorClass}-500 shadow-[0_0_15px_rgba(var(--${colorClass}-rgb), 0.3)]` : "border-zinc-800",
    "hover:border-zinc-600"
  )}>
    {children}
  </div>
);

// --- 1. START NODE ---
export const StartNode = memo(({ selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="green">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-green-500/20 text-green-500">
            <Zap className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">Início</h3>
            <p className="text-[10px] text-zinc-500">Gatilho da conversa</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-green-500" />
    </NodeWrapper>
  );
});
StartNode.displayName = 'StartNode';

// --- 2. PERSONALITY NODE ---
export const PersonalityNode = memo(({ data, selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="purple">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-purple-500/20 text-purple-500">
            <Bot className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">Personalidade</h3>
            <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                {data.role ? String(data.role) : 'Não configurado'}
            </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-purple-500" />
    </NodeWrapper>
  );
});
PersonalityNode.displayName = 'PersonalityNode';

// --- 3. KNOWLEDGE NODE ---
export const KnowledgeNode = memo(({ data, selected }: NodeProps) => {
  const fileCount = (data.files as any[])?.length || 0;
  return (
    <NodeWrapper selected={selected} colorClass="orange">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-orange-500/20 text-orange-500">
            <Database className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">Conhecimento</h3>
            <p className="text-[10px] text-zinc-500">
                {fileCount} arquivos carregados
            </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-orange-500" />
    </NodeWrapper>
  );
});
KnowledgeNode.displayName = 'KnowledgeNode';

// --- 4. SPECIALIST NODE (TÉCNICAS) ---
export const SpecialistNode = memo(({ data, selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="blue">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-blue-500/20 text-blue-500">
            <Brain className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">Especialista</h3>
            <p className="text-[10px] text-zinc-500">
                Regras de Negócio
            </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </NodeWrapper>
  );
});
SpecialistNode.displayName = 'SpecialistNode';

// --- 5. TOOL NODE (INTEGRAÇÕES) ---
export const ToolNode = memo(({ data, selected }: NodeProps) => {
  const toolType = data.toolType as string;
  let Icon = Settings;
  let label = "Ferramenta";
  let status = "Integração";
  
  if (toolType === 'calendar') { Icon = Calendar; label = "Agenda"; }
  else if (toolType === 'crm') { Icon = PhoneCall; label = "CRM"; }
  else if (toolType === 'files') { 
      Icon = Cloud; 
      label = "Drive";
      status = data.drive_folder_id ? "Pasta Conectada" : "Sem Pasta";
  }

  return (
    <NodeWrapper selected={selected} colorClass="pink">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-pink-500/20 text-pink-500">
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">{label}</h3>
            <p className={cn("text-[10px]", data.drive_folder_id ? "text-green-400" : "text-zinc-500")}>
                {status}
            </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-pink-500" />
    </NodeWrapper>
  );
});
ToolNode.displayName = 'ToolNode';

// --- 6. GUARD NODE (REGRAS/SEGURANÇA) ---
export const GuardNode = memo(({ data, selected }: NodeProps) => {
  return (
    <NodeWrapper selected={selected} colorClass="red">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-red-500/20 text-red-500">
            <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
            <h3 className="text-sm font-bold text-white">Regras & Bloqueios</h3>
            <p className="text-[10px] text-zinc-500">Safety Layer</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-red-500" />
    </NodeWrapper>
  );
});
GuardNode.displayName = 'GuardNode';
