
'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel
} from '@xyflow/react';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { Agent, AgentLevel } from '@/types';
import { useToast } from '@/hooks/useToast';
import { 
    StartNode, PersonalityNode, KnowledgeNode, SpecialistNode, ToolNode, GuardNode 
} from './flow/FlowNodes';
import { NodeInspector } from './flow/NodeInspector';
import { Button } from '@/components/ui/button';
import { Save, Bot, Brain, Database, ShieldCheck, Settings, ArrowLeft, Loader2 } from 'lucide-react';
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

const INITIAL_NODES: Node[] = [
  { id: 'start-1', type: 'start', position: { x: 100, y: 300 }, data: { label: 'Start' } }
];

interface AgentFlowBuilderProps {
    initialData?: Agent | null;
    companyId: string;
    level: AgentLevel; // 'pleno' ou 'senior'
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
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // --- NODE SELECTION ---
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // --- CONNECT ---
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // --- DRAG & DROP ---
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

  // --- SAVE ---
  const handleSave = async () => {
      setIsSaving(true);
      try {
          // 1. Compilação do Prompt (Lógica Simplificada para Demo)
          // Em produção, isso iteraria sobre os nós conectados para construir o texto
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

          // Compilação de Conhecimento (Textos apenas, mídia é processada no backend)
          // Aqui salvamos a estrutura no JSONB, o backend que se vira pra ler os arquivos
          const knowledgeConfig = {
              text_files: knowledgeNodes.flatMap(n => n.data.files || []),
              media_files: [] // Mídias são tratadas separadamente se necessário
          };

          // Extração da Config de Ferramentas
          const toolsConfig = {
              drive_integration: toolNode?.data?.toolType === 'files',
              drive_folder_id: toolNode?.data?.drive_folder_id || null, // ID da pasta selecionada
              calendar_integration: toolNode?.data?.toolType === 'calendar'
          };

          const payload = {
              company_id: companyId,
              name: agentName,
              level,
              prompt_instruction: compiledPrompt,
              flow_config: { nodes, edges }, // Salva o gráfico visual
              knowledge_config: knowledgeConfig,
              tools_config: toolsConfig,
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

  // --- UPDATER DO INSPECTOR ---
  const handleNodeUpdate = (id: string, newData: any) => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden relative">
        
        {/* HEADER */}
        <div className="h-16 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onSuccess}><ArrowLeft className="w-5 h-5" /></Button>
                <div>
                    <input 
                        value={agentName} 
                        onChange={e => setAgentName(e.target.value)} 
                        className="bg-transparent text-white font-bold text-lg outline-none placeholder:text-zinc-600"
                        placeholder="Nome do Agente"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded border", level === 'senior' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30")}>
                            Nível {level}
                        </span>
                        <span className="text-[10px] text-zinc-500">Fluxo Visual Ativo</span>
                    </div>
                </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className={cn("text-white font-bold shadow-lg", level === 'senior' ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20" : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20")}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Fluxo
            </Button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            
            {/* SIDEBAR (PALETTE) */}
            <div className="w-60 border-r border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar z-10">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nós Disponíveis</p>
                
                <DraggableNode type="personality" label="Personalidade" icon={Bot} color="purple" />
                <DraggableNode type="knowledge" label="Conhecimento" icon={Database} color="orange" />
                <DraggableNode type="specialist" label="Especialista" icon={Brain} color="blue" />
                <DraggableNode type="guard" label="Regras & Bloqueios" icon={ShieldCheck} color="red" />
                
                {level === 'senior' && (
                    <>
                    <div className="h-px bg-zinc-800 my-2" />
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Ferramentas Sênior</p>
                    <DraggableNode type="tool" label="Integração" icon={Settings} color="pink" />
                    </>
                )}
            </div>

            {/* CANVAS */}
            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
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
                        fitView
                        className="bg-[#050505]"
                    >
                        <Background color="#222" gap={20} />
                        <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-400" />
                        
                        {/* Legend Panel */}
                        <Panel position="bottom-center" className="bg-zinc-900/80 p-2 rounded-full border border-zinc-800 flex gap-4 backdrop-blur text-[10px] text-zinc-400">
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> Início</div>
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"/> Persona</div>
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"/> Dados</div>
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Lógica</div>
                        </Panel>
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
                />
            )}
        </div>
    </div>
  );
}

// Helper para Drag
const DraggableNode = ({ type, label, icon: Icon, color }: any) => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const colorClasses: any = {
        purple: "text-purple-400 border-purple-500/20 hover:bg-purple-500/10",
        orange: "text-orange-400 border-orange-500/20 hover:bg-orange-500/10",
        blue: "text-blue-400 border-blue-500/20 hover:bg-blue-500/10",
        red: "text-red-400 border-red-500/20 hover:bg-red-500/10",
        pink: "text-pink-400 border-pink-500/20 hover:bg-pink-500/10"
    };

    return (
        <div 
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-zinc-950 cursor-grab active:cursor-grabbing transition-all",
                colorClasses[color]
            )}
            draggable
            onDragStart={(event) => onDragStart(event, type)}
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium text-zinc-200">{label}</span>
        </div>
    );
};
