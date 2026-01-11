'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, CheckCircle, AlertCircle, Loader2, Plus, Lock, QrCode, Trash2, Signal, Wifi, Activity, Terminal, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';
import { Instance } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useCompany } from '@/hooks/useCompany';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { createClient } from '@/utils/supabase/client';

const PLAN_LIMITS = {
  starter: 1,
  pro: 3,
  scale: 10
};

export default function ConnectionsPage() {
  const { addToast } = useToast();
  const { company } = useCompany();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Busca inicial
  const fetchInstances = async () => {
      try {
          const data = await whatsappService.getAllInstances();
          setInstances(data);
          setLoading(false);
      } catch (error) {
          console.error(error);
      }
  };

  useEffect(() => {
    fetchInstances();

    if (!company?.id) return;

    // REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('instances-changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'instances',
          filter: `company_id=eq.${company.id}`
        },
        (payload) => {
          fetchInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, supabase]);

  const handleCreateInstance = async () => {
      if(!newSessionName.trim()) return;
      setIsCreating(true);
      try {
          // 1. Gera ID técnico (sanitizado) para o Backend/Baileys
          const sessionId = newSessionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          
          if(instances.find(i => i.session_id === sessionId)) {
              throw new Error("Já existe uma conexão com este ID.");
          }

          // 2. Chama o serviço passando o ID técnico E o Nome Original (Display Name)
          await whatsappService.connectInstance(sessionId, newSessionName);
          
          addToast({ type: 'success', title: 'Solicitação Enviada', message: 'Gerando QR Code...' });
          setIsModalOpen(false);
          setNewSessionName('');
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro de Conexão', message: error.message });
      } finally {
          setIsCreating(false);
      }
  };

  const limit = PLAN_LIMITS[(company?.plan as keyof typeof PLAN_LIMITS) || 'starter'] || 1;
  const usedSlots = instances.length;
  const availableSlots = limit - usedSlots;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header Futurista */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-zinc-800 pb-6 relative">
        <div className="absolute -bottom-px left-0 w-32 h-px bg-primary shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-primary animate-pulse" />
            Conexões WhatsApp
          </h1>
          <p className="text-zinc-400 mt-2 font-light">
            Gerenciamento de gateways WhatsApp e instâncias ativas.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="bg-zinc-900/50 px-4 py-2 rounded-lg border border-zinc-800 text-xs font-mono">
                <span className="text-zinc-500 mr-2">SLOTS:</span>
                <span className={cn("font-bold", availableSlots > 0 ? "text-primary" : "text-red-500")}>
                    {usedSlots} / {limit}
                </span>
            </div>
            {availableSlots > 0 && (
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-primary/20">
                    <Plus className="w-5 h-5 mr-2" /> Nova Instância
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Renderiza Instâncias Existentes */}
        {instances.map((instance) => (
            <ConnectionCard key={instance.id} instance={instance} />
        ))}

        {/* Renderiza Slots Vazios / Bloqueados */}
        {Array.from({ length: Math.max(0, limit - instances.length) }).map((_, i) => (
             <div key={`empty-${i}`} className="group relative border border-dashed border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center bg-zinc-900/10 min-h-[400px] overflow-hidden hover:border-zinc-700 transition-all">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite] pointer-events-none"></div>
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                    <Smartphone className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-lg font-bold text-zinc-500">Slot Disponível</h3>
                <p className="text-sm text-zinc-600 mb-6 text-center max-w-xs font-mono">
                    Recurso de conexão inativo.<br/>Inicie uma nova instância para ativar.
                </p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)} className="border-zinc-700 hover:bg-zinc-800 hover:text-white bg-transparent">
                    <Plus className="w-4 h-4 mr-2" /> Inicializar
                </Button>
             </div>
        ))}
        
        {/* Banner de Upgrade */}
        {company?.plan !== 'scale' && instances.length >= limit && (
             <div className="border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 min-h-[400px] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-blue-900/10 opacity-50"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                        <Lock className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Expansão Necessária</h3>
                    <p className="text-sm text-zinc-400 mb-6 text-center max-w-xs mt-2">
                        Limite do plano {company?.plan?.toUpperCase()} atingido.<br/>
                        Faça upgrade para liberar o núcleo.
                    </p>
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] border border-purple-400/20">
                        Desbloquear Núcleo
                    </Button>
                </div>
             </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Conexão">
          <div className="space-y-6">
              <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 flex gap-3">
                  <Terminal className="w-5 h-5 text-primary mt-1" />
                  <div className="text-sm text-zinc-400">
                      <p className="font-bold text-zinc-200 mb-1">Configuração de Identificador</p>
                      Defina um nome único para esta sessão. Use nomes funcionais como "Vendas", "Suporte" ou "Bot-01".
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-primary uppercase mb-2 block tracking-wider">Nome da Sessão</label>
                  <Input 
                    value={newSessionName} 
                    onChange={e => setNewSessionName(e.target.value)}
                    placeholder="Ex: Comercial 01" 
                    className="h-12 bg-zinc-900 border-zinc-700 text-white font-mono"
                    autoFocus
                  />
              </div>
              <div className="flex justify-end pt-2">
                  <Button onClick={handleCreateInstance} isLoading={isCreating} disabled={!newSessionName.trim()} className="w-full sm:w-auto">
                      Iniciar Protocolo de Conexão
                  </Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}

// Sub-componente Card Otimizado
const ConnectionCard: React.FC<{ instance: Instance }> = ({ instance }) => {
    const { addToast } = useToast();
    const [actionLoading, setActionLoading] = useState(false);

    const handleConnect = async () => {
        setActionLoading(true);
        try {
            // Re-usa o nome existente para não sobrescrever com o session_id
            await whatsappService.connectInstance(instance.session_id, instance.name);
            addToast({ type: 'info', title: 'System', message: 'Solicitando novo QR Code...' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!confirm(`Encerrar uplink com ${instance.name || instance.session_id}?`)) return;
        setActionLoading(true);
        try {
            await whatsappService.logoutInstance(instance.session_id);
            addToast({ type: 'success', title: 'Desconectado', message: 'Sessão encerrada com sucesso.' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`ATENÇÃO: Excluir a instância ${instance.session_id} permanentemente?`)) return;
        setActionLoading(true);
        try {
            try { await whatsappService.logoutInstance(instance.session_id); } catch(e) {}
            const supabase = createClient();
            await supabase.from('instances').delete().eq('id', instance.id);
            addToast({ type: 'success', title: 'Excluído', message: 'Registro removido do banco de dados.' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setActionLoading(false);
        }
    }

    const renderQrCode = () => {
        if (!instance.qrcode_url) return null;
        const src = instance.qrcode_url.startsWith('data:image') 
            ? instance.qrcode_url 
            : `data:image/png;base64,${instance.qrcode_url}`;

        return (
            <div className="relative group animate-in zoom-in duration-300">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-emerald-600 rounded-lg blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white p-3 rounded-lg shadow-2xl overflow-hidden">
                    <img src={src} alt="Scan Me" className="w-48 h-48 object-contain relative z-10" />
                    {/* Scanner Effect */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.8)] z-20 animate-scan"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="group bg-zinc-950/50 border border-zinc-800 hover:border-primary/30 rounded-2xl overflow-hidden flex flex-col md:flex-row h-full min-h-[400px] transition-all duration-300 shadow-lg relative">
            {/* Background Grid Subtle */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

            {/* Coluna Esquerda: Status & Controls */}
            <div className="p-8 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900/20 backdrop-blur-sm relative z-10">
                <div>
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {instance.status === 'connected' && <div className="absolute inset-0 bg-primary/20 rounded-full blur-md animate-pulse"></div>}
                                <div className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center border-2 shadow-inner transition-all relative z-10",
                                    instance.status === 'connected' ? 'bg-zinc-900 border-primary text-primary' : 
                                    instance.status === 'qr_ready' ? 'bg-zinc-900 border-yellow-500 text-yellow-500' :
                                    'bg-zinc-900 border-red-900 text-red-700'
                                )}>
                                    {instance.status === 'connected' ? <Wifi className="w-6 h-6" /> : 
                                     instance.status === 'qr_ready' ? <QrCode className="w-6 h-6 animate-pulse" /> :
                                     <Power className="w-6 h-6" />}
                                </div>
                                {/* Online Dot */}
                                {instance.status === 'connected' && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-xl tracking-tight">{instance.name || instance.session_id}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                        ID: {instance.session_id}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-zinc-500 font-mono uppercase">Status do Sistema</span>
                                <Activity className={cn("w-3 h-3", instance.status === 'connected' ? "text-primary animate-pulse" : "text-zinc-700")} />
                            </div>
                            <span className={cn("text-sm font-bold flex items-center gap-2", 
                                instance.status === 'connected' ? "text-primary drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]" : 
                                instance.status === 'disconnected' ? "text-red-500" : "text-yellow-500"
                            )}>
                                {instance.status === 'connected' ? 'ONLINE • ESTÁVEL' : 
                                 instance.status === 'qr_ready' ? 'AGUARDANDO LEITURA' :
                                 instance.status === 'connecting' ? 'INICIANDO HANDSHAKE...' :
                                 'OFFLINE'}
                            </span>
                        </div>
                        
                        {instance.status === 'connected' && (
                            <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 shadow-inner">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-zinc-500 font-mono uppercase">Bateria do Dispositivo</span>
                                    <span className="text-xs font-mono text-zinc-300">{instance.battery_level || 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full rounded-full shadow-[0_0_10px_currentColor]", 
                                            (instance.battery_level || 0) > 20 ? "bg-primary text-primary" : "bg-red-500 text-red-500"
                                        )} 
                                        style={{ width: `${instance.battery_level || 0}%` }} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    {instance.status === 'connected' ? (
                        <Button variant="destructive" onClick={handleLogout} isLoading={actionLoading} className="w-full border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                            <Power className="w-4 h-4 mr-2" /> Encerrar Sessão
                        </Button>
                    ) : (
                        <Button 
                            variant="default" 
                            onClick={handleConnect} 
                            isLoading={actionLoading || instance.status === 'connecting'} 
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", (actionLoading || instance.status === 'connecting') && "animate-spin")} />
                            {instance.status === 'qr_ready' ? 'Gerar Novo QR' : 'Inicializar Conexão'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Coluna Direita: Visual Feedback */}
            <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 relative overflow-hidden min-h-[350px]">
                {/* Background Tech Effects */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent pointer-events-none"></div>
                
                {instance.status === 'connected' ? (
                     <div className="text-center space-y-6 relative z-10 animate-in fade-in zoom-in duration-500">
                        <div className="relative mx-auto w-32 h-32">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative w-full h-full bg-zinc-900 rounded-full border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                <Smartphone className="w-12 h-12 text-primary" />
                            </div>
                            {/* Orbiting effect */}
                            <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_4s_linear_infinite]"></div>
                            <div className="absolute -inset-4 rounded-full border border-dashed border-primary/10 animate-[spin_8s_linear_infinite_reverse]"></div>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Sincronização Completa</h3>
                            <p className="text-zinc-500 text-xs mt-2 max-w-[220px] mx-auto font-mono">
                                &gt; Uplink estabelecido<br/>&gt; Mensagens fluindo...
                            </p>
                        </div>
                    </div>
                ) : instance.qrcode_url ? (
                    <div className="text-center space-y-4 relative z-10 w-full flex flex-col items-center">
                        <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-2 animate-pulse">Aguardando Escaneamento...</p>
                        {renderQrCode()}
                        <div className="mt-4 px-4 py-2 bg-zinc-900/80 rounded border border-zinc-800 text-xs text-zinc-500 font-mono">
                            WhatsApp &gt; Menu &gt; Aparelhos Conectados
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-600 relative z-10">
                        <div className="w-24 h-24 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mx-auto mb-6">
                            <QrCode className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-zinc-500 text-sm px-4 font-mono">
                            {instance.status === 'connecting' 
                                ? '>[Iniciando Servidor]...' 
                                : '>[Aguardando Comando de Inicialização]'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}