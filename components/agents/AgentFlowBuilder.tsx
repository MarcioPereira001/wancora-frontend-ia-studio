
'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  BackgroundVariant
} from '@xyflow/react';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { Agent, AgentLevel, PipelineStage } from '@/types';
import { useToast } from '@/hooks/useToast';
import { 
    StartNode, PersonalityNode, KnowledgeNode, SpecialistNode, ToolNode, GuardNode 
} from './flow/FlowNodes';
import { NodeInspector } from './flow/NodeInspector';
import { Button } from '@/components/ui/button';
import { Save, Bot, Brain, Database, ShieldCheck, Settings, ArrowLeft, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- NODE TYPES REGISTRY ---
const nodeTypes = {
  start: StartNode,
  personality: PersonalityNode,
  knowledge: KnowledgeNode,
  specialist: SpecialistNode,
  tool: ToolNode,
  guard: GuardNode
};

// Start Node padrão
const INITIAL_NODES: Node[] = [
  { id: 'start-1', type: 'start', position: { x: 100, y: 300 }, data: { label: 'Start', trigger: { type: 'all_messages' } } }
];

interface AgentFlowBuilderProps {
    initialData?: Agent | null;
    companyId: string;
    level: AgentLevel; 
    onSuccess: () => void;
}

export function AgentFlowBuilder({ initialData, companyId, level, onSuccess }: AgentFlowBuilderProps) {
  const { addToast } = useToast();
  const supabase = createClient();
  
  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.flow_config?.nodes || INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.flow_config?.edges || []);
  
  // UI State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [agentName, setAgentName] = useState(initialData?.name || `Agente ${level === 'pleno' ? 'Pleno' : 'Sênior'}`);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const fetchStages = async () => {
          const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
          if (data) setStages(data as PipelineStage[]);
      };
      fetchStages();
  }, [companyId]);

  useEffect(() => {
      if (initialData?.trigger_config) {
          setNodes(nds => nds.map(n => n.type === 'start' ? { ...n, data: { ...n.data, trigger: initialData.trigger_config } } : n));
      }
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = {
        x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0),
        y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0),
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: type }
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleSave = async () => {
      setIsSaving(true);
      try {
          const startNode = nodes.find(n => n.type === 'start');
          const triggerConfig = startNode?.data?.trigger || { type: 'all_messages' };

          // Compilação do Prompt (Simplificada)
          const personalityNode = nodes.find(n => n.type === 'personality');
          const guardNode = nodes.find(n => n.type === 'guard');
          const specialistNodes = nodes.filter(n => n.type === 'specialist');
          const knowledgeNodes = nodes.filter(n => n.type === 'knowledge');
          const toolNode = nodes.find(n => n.type === 'tool');

          let compiledPrompt = `Você é um agente ${level}. `;
          if(personalityNode) compiledPrompt += `Seu papel é ${personalityNode.data.role}. Tom: ${personalityNode.data.tone}. ${personalityNode.data.context || ''} `;
          
          specialistNodes.forEach(n => {
              compiledPrompt += `Use técnica ${n.data.technique}. ${n.data.instruction || ''} `;
          });

          if(guardNode) {
              if(guardNode.data.negative_prompts) compiledPrompt += `NUNCA diga: ${guardNode.data.negative_prompts.join(', ')}. `;
          }

          const knowledgeConfig = {
              text_files: knowledgeNodes.flatMap(n => n.data.files || []),
              media_files: [] 
          };

          const toolsConfig = {
              drive_integration: toolNode?.data?.toolType === 'files',
              drive_folder_id: toolNode?.data?.drive_folder_id || null, 
              calendar_integration: toolNode?.data?.toolType === 'calendar'
          };

          const payload = {
              company_id: companyId,
              name: agentName,
              level,
              prompt_instruction: compiledPrompt,
              flow_config: { nodes, edges },
              knowledge_config: knowledgeConfig,
              tools_config: toolsConfig,
              trigger_config: triggerConfig,
              is_active: initialData?.is_active ?? true,
              model: level === 'senior' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
              transcription_enabled: true
          };

          if (initialData?.id) {
              await supabase.from('agents').update(payload).eq('id', initialData.id);
          } else {
              await supabase.from('agents').insert(payload);
          }

          addToast({ type: 'success', title: 'Salvo', message: 'Fluxo do agente atualizado.' });
          onSuccess();

      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setIsSaving(false);
      }
  };

  const handleNodeUpdate = (id: string, newData: any) => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden relative shadow-2xl">
        
        {/* HEADER */}
        <div className="h-16 border-b border-zinc-800 bg-[#0c0c0e] px-4 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onSuccess}><ArrowLeft className="w-5 h-5 text-zinc-400" /></Button>
                <div>
                    <input 
                        value={agentName} 
                        onChange={e => setAgentName(e.target.value)} 
                        className="bg-transparent text-white font-bold text-lg outline-none placeholder:text-zinc-600 focus:underline decoration-zinc-700"
                        placeholder="Nome do Agente"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-widest", level === 'senior' ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30")}>
                            Nível {level}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/> Editor Visual</span>
                    </div>
                </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className={cn("text-white font-bold shadow-lg h-9", level === 'senior' ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20" : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20")}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Fluxo
            </Button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            
            {/* SIDEBAR (PALETTE) */}
            <div className="w-64 border-r border-zinc-800 bg-[#0c0c0e] p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar z-10 shadow-xl">
                <div className="mb-2 px-1">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Cérebro</p>
                    <DraggableNode type="personality" label="Personalidade" icon={Bot} color="purple" desc="Papel e tom de voz" />
                </div>

                <div className="mb-2 px-1">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Conhecimento</p>
                    <DraggableNode type="knowledge" label="Base de Dados" icon={Database} color="orange" desc="Arquivos e textos" />
                    <DraggableNode type="specialist" label="Especialista" icon={Brain} color="blue" desc="Técnicas de Venda" />
                </div>
                
                <div className="mb-2 px-1">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Segurança</p>
                    <DraggableNode type="guard" label="Guardrails" icon={ShieldCheck} color="red" desc="Regras de bloqueio" />
                </div>
                
                {level === 'senior' && (
                    <div className="mb-2 px-1 animate-in fade-in slide-in-from-left-2">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Integrações (Sênior)</p>
                        <DraggableNode type="tool" label="Ferramentas" icon={Settings} color="pink" desc="Drive, Calendar, CRM" />
                    </div>
                )}
            </div>

            {/* CANVAS */}
            <div className="flex-1 h-full relative bg-[#050505]" ref={reactFlowWrapper}>
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        proOptions={{ hideAttribution: true }}
                        snapToGrid
                        snapGrid={[20, 20]}
                        fitView
                        className="bg-[#050505]"
                    >
                        <Background color="#222" gap={20} variant={BackgroundVariant.Dots} size={1} />
                        <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-400" />
                    </ReactFlow>
                </ReactFlowProvider>
            </div>

            {/* INSPECTOR (RIGHT SIDEBAR) */}
            {selectedNodeId && (
                <NodeInspector 
                    node={nodes.find(n => n.id === selectedNodeId) || null} 
                    onClose={() => setSelectedNodeId(null)}
                    onUpdate={handleNodeUpdate}
                    agentLevel={level}
                    companyId={companyId}
                    stages={stages}
                />
            )}
        </div>
    </div>
  );
}

// Helper para Drag (Visual Melhorado)
const DraggableNode = ({ type, label, icon: Icon, color, desc }: any) => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const colorClasses: any = {
        purple: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_15px_-5px_rgba(168,85,247,0.4)]",
        orange: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_15px_-5px_rgba(249,115,22,0.4)]",
        blue: "group-hover:border-blue-500/50 group-hover:shadow-[0_0_15px_-5px_rgba(59,130,246,0.4)]",
        red: "group-hover:border-red-500/50 group-hover:shadow-[0_0_15px_-5px_rgba(239,68,68,0.4)]",
        pink: "group-hover:border-pink-500/50 group-hover:shadow-[0_0_15px_-5px_rgba(236,72,153,0.4)]"
    };

    const iconColors: any = {
        purple: "text-purple-400 bg-purple-500/10",
        orange: "text-orange-400 bg-orange-500/10",
        blue: "text-blue-400 bg-blue-500/10",
        red: "text-red-400 bg-red-500/10",
        pink: "text-pink-400 bg-pink-500/10"
    };

    return (
        <div 
            className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-[#121214] cursor-grab active:cursor-grabbing transition-all duration-300 hover:bg-zinc-900",
                colorClasses[color]
            )}
            draggable
            onDragStart={(event) => onDragStart(event, type)}
        >
            <div className={cn("p-2 rounded-lg shrink-0", iconColors[color])}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{label}</span>
                <span className="text-[10px] text-zinc-500">{desc}</span>
            </div>
            <GripVertical className="w-4 h-4 text-zinc-700 ml-auto group-hover:text-zinc-500" />
        </div>
    );
};
