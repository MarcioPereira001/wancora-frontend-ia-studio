'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, CheckCircle, AlertCircle, Loader2, Plus, Lock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';
import { Instance } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useCompany } from '@/hooks/useCompany';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';

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
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Polling para atualizar QR Codes e Status de todas as instâncias
  useEffect(() => {
    let isMounted = true;
    const fetchInstances = async () => {
        try {
            const data = await whatsappService.getAllInstances();
            if (isMounted) {
                setInstances(data);
                setLoading(false);
            }
        } catch (error) {
            console.error(error);
        }
    };

    fetchInstances();
    const interval = setInterval(fetchInstances, 3000); // 3s polling para atualização em tempo real
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, []);

  const handleCreateInstance = async () => {
      if(!newSessionName.trim()) return;
      setIsCreating(true);
      try {
          // Normaliza o nome para ser um ID válido (sem espaços, minúsculo)
          const sessionId = newSessionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          
          // Verifica duplicidade no frontend
          if(instances.find(i => i.session_id === sessionId)) {
              throw new Error("Já existe uma conexão com este nome.");
          }

          await whatsappService.connectInstance(sessionId);
          addToast({ type: 'success', title: 'Criado', message: 'Nova conexão iniciada. Aguarde o QR Code.' });
          setIsModalOpen(false);
          setNewSessionName('');
          // Refresh imediato
          const data = await whatsappService.getAllInstances();
          setInstances(data);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setIsCreating(false);
      }
  };

  const limit = PLAN_LIMITS[(company?.plan as keyof typeof PLAN_LIMITS) || 'starter'] || 1;
  const usedSlots = instances.length;
  const availableSlots = limit - usedSlots;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Conexões WhatsApp</h1>
          <p className="text-zinc-400 mt-1">
            Gerencie as instâncias conectadas ao seu CRM.
            <span className="ml-2 inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700/10">
              Plano {company?.plan?.toUpperCase() || '...'}: {usedSlots}/{limit} Ativos
            </span>
          </p>
        </div>
        
        {availableSlots > 0 && (
            <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                <Plus className="w-5 h-5 mr-2" /> Nova Conexão
            </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Renderiza Instâncias Existentes */}
        {instances.map((instance) => (
            <ConnectionCard key={instance.id} instance={instance} />
        ))}

        {/* Renderiza Slots Vazios / Bloqueados */}
        {Array.from({ length: Math.max(0, limit - instances.length) }).map((_, i) => (
             <div key={`empty-${i}`} className="border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/20 min-h-[400px]">
                <Smartphone className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-zinc-500">Espaço Disponível</h3>
                <p className="text-sm text-zinc-600 mb-6 text-center">Conecte um novo número para <br/>expandir seu atendimento.</p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)} className="border-zinc-700 hover:bg-zinc-800 hover:text-white">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
             </div>
        ))}
        
        {/* Banner de Upgrade se atingiu limite e não é Scale */}
        {company?.plan !== 'scale' && instances.length >= limit && (
             <div className="border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/50 min-h-[400px] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 group-hover:opacity-100 transition-opacity"></div>
                <Lock className="w-12 h-12 mb-4 text-purple-500/50" />
                <h3 className="text-lg font-bold text-white">Desbloqueie mais conexões</h3>
                <p className="text-sm text-zinc-400 mb-6 text-center max-w-xs">
                    Faça upgrade para o plano {company?.plan === 'starter' ? 'PRO' : 'SCALE'} e tenha até {company?.plan === 'starter' ? '3' : '10'} números conectados.
                </p>
                <Button className="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                    Fazer Upgrade
                </Button>
             </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Conexão">
          <div className="space-y-4">
              <p className="text-sm text-zinc-400">Dê um nome para identificar este número (ex: Vendas, Suporte, Comercial 2).</p>
              <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Nome da Sessão</label>
                  <Input 
                    value={newSessionName} 
                    onChange={e => setNewSessionName(e.target.value)}
                    placeholder="Ex: Comercial-SP" 
                    className="mt-1"
                    autoFocus
                  />
              </div>
              <div className="flex justify-end pt-4">
                  <Button onClick={handleCreateInstance} isLoading={isCreating} disabled={!newSessionName.trim()}>
                      Criar e Conectar
                  </Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}

// Sub-componente que isola a lógica de cada card
function ConnectionCard({ instance }: { instance: Instance }) {
    const { addToast } = useToast();
    const [actionLoading, setActionLoading] = useState(false);

    const handleConnect = async () => {
        setActionLoading(true);
        try {
            await whatsappService.connectInstance(instance.session_id);
            addToast({ type: 'info', title: 'Iniciando', message: 'Solicitando QR Code...' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!confirm(`Desconectar ${instance.name || instance.session_id}?`)) return;
        setActionLoading(true);
        try {
            await whatsappService.logoutInstance(instance.session_id);
            addToast({ type: 'success', title: 'Desconectado', message: 'Sessão encerrada.' });
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const renderQrCode = () => {
        if (!instance.qrcode_url) return null;
        const src = instance.qrcode_url.startsWith('data:image') 
            ? instance.qrcode_url 
            : `data:image/png;base64,${instance.qrcode_url}`;

        return (
            <div className="bg-white p-2 rounded-lg inline-block shadow-lg animate-in zoom-in duration-300">
                <img src={src} alt="Scan Me" className="w-40 h-40 object-contain" />
            </div>
        );
    };

    return (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden flex flex-col md:flex-row h-full min-h-[400px] transition-all hover:border-zinc-700">
            {/* Coluna Esquerda: Status */}
            <div className="p-6 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-800">
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                            instance.status === 'connected' ? 'border-green-500 bg-green-500/10' : 
                            instance.status === 'qr_ready' || instance.status === 'connecting' ? 'border-yellow-500 bg-yellow-500/10' :
                            'border-red-500 bg-red-500/10'
                        }`}>
                             {instance.status === 'connected' ? <CheckCircle className="w-6 h-6 text-green-500" /> : 
                              instance.status === 'qr_ready' || instance.status === 'connecting' ? <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" /> :
                              <AlertCircle className="w-6 h-6 text-red-500" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">{instance.name || instance.session_id}</h3>
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wide">{instance.session_id}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                            <span className="text-xs text-zinc-500 block mb-1">Status</span>
                            <span className={cn("text-sm font-bold flex items-center gap-2", 
                                instance.status === 'connected' ? "text-green-400" : 
                                instance.status === 'disconnected' ? "text-red-400" : "text-yellow-400"
                            )}>
                                {instance.status === 'connected' ? 'ONLINE E SINCRONIZADO' : 
                                 instance.status.toUpperCase().replace('_', ' ')}
                            </span>
                        </div>
                        {instance.battery_level !== undefined && instance.battery_level !== null && (
                            <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                                <span className="text-xs text-zinc-500 block mb-1">Bateria do Celular</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${instance.battery_level}%` }} />
                                    </div>
                                    <span className="text-xs text-zinc-300 font-mono">{instance.battery_level}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    {instance.status === 'connected' ? (
                        <Button variant="destructive" onClick={handleLogout} isLoading={actionLoading} className="w-full">
                            <Power className="w-4 h-4 mr-2" /> Desconectar
                        </Button>
                    ) : (
                        <Button 
                            variant="default" 
                            onClick={handleConnect} 
                            isLoading={actionLoading || instance.status === 'connecting'} 
                            className="w-full bg-primary hover:bg-primary/90 text-white"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
                            {instance.status === 'qr_ready' ? 'Gerar Novo QR' : 'Iniciar Conexão'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Coluna Direita: QR Code Area */}
            <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden min-h-[300px]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                
                {instance.status === 'connected' ? (
                     <div className="text-center space-y-4 relative z-10 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                            <Smartphone className="w-10 h-10 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">Conexão Estabelecida</h3>
                            <p className="text-zinc-500 text-xs mt-1 max-w-[200px] mx-auto">
                                O Wancora está recebendo e enviando mensagens através desta sessão.
                            </p>
                        </div>
                    </div>
                ) : instance.qrcode_url ? (
                    <div className="text-center space-y-4 relative z-10">
                        {renderQrCode()}
                        <div>
                            <p className="text-white font-medium text-sm">Escaneie o QR Code</p>
                            <p className="text-zinc-500 text-[10px]">WhatsApp &gt; Aparelhos conectados</p>
                        </div>
                        <p className="text-[10px] text-yellow-500/80 animate-pulse font-mono">
                            Atualizando status...
                        </p>
                    </div>
                ) : (
                    <div className="text-center text-zinc-600 relative z-10">
                        <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-zinc-500 text-sm px-4">
                            {instance.status === 'connecting' 
                                ? 'Aguardando servidor...' 
                                : 'Clique em "Iniciar Conexão" ao lado para gerar o QR Code.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}