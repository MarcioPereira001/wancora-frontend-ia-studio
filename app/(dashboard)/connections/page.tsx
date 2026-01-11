'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Power, Trash2, Wifi, Terminal, MessageCircle, CheckCircle2, Loader2, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';
import { Instance } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useCompany } from '@/hooks/useCompany';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { createClient } from '@/utils/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

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
  
  // Modal State Logic
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'initializing' | 'qr_scan' | 'success'>('input');
  const [newSessionName, setNewSessionName] = useState('');
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);

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

    // Monitoramento Global da Lista
    const channel = supabase
      .channel('instances-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instances', filter: `company_id=eq.${company.id}` }, 
        () => fetchInstances()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [company?.id, supabase]);

  // --- MONITORAMENTO DO MODAL (QR CODE) ---
  useEffect(() => {
    if (!isModalOpen || !currentInstance?.session_id) return;

    const sessionId = currentInstance.session_id;
    let intervalId: ReturnType<typeof setInterval>;

    const checkStatus = async () => {
        // Busca direta (bypassing cache se possível)
        const { data: freshData, error } = await supabase
            .from('instances')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();
        
        if (error || !freshData) {
            // Se sumiu do banco, pode ter sido deletado ou erro fatal
            console.log("Instância não encontrada ou erro:", error);
            return;
        }

        // Atualiza estado local
        setCurrentInstance(freshData as Instance);

        // 1. CONECTADO
        if (freshData.status === 'connected') {
            if (step !== 'success') {
                setStep('success');
                addToast({ type: 'success', title: 'Conectado!', message: 'Instância sincronizada.' });
                setTimeout(() => {
                    setIsModalOpen(false);
                    resetModal();
                    fetchInstances();
                }, 2000);
            }
        } 
        // 2. QR CODE DISPONÍVEL (Qualquer status que não seja connected, se tiver QR string, mostre!)
        else if (freshData.qrcode_url && freshData.qrcode_url.length > 10) {
            if (step !== 'qr_scan') setStep('qr_scan');
        }
    };

    // Executa imediatamente
    checkStatus();

    // Polling a cada 2s (suficiente para não travar a rede)
    intervalId = setInterval(checkStatus, 2000);

    // Realtime via Supabase (Backup do Polling)
    const modalChannel = supabase
      .channel(`instance-modal-${sessionId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'instances', 
          filter: `session_id=eq.${sessionId}` 
      }, (payload) => {
          // Reagir imediatamente ao evento do banco
          const newRow = payload.new as Instance;
          if (newRow.qrcode_url) setStep('qr_scan');
          if (newRow.status === 'connected') setStep('success');
      })
      .subscribe();

    return () => { 
        supabase.removeChannel(modalChannel);
        clearInterval(intervalId);
    };
  }, [isModalOpen, currentInstance?.session_id, step, supabase, addToast]); 

  const resetModal = () => {
      setStep('input');
      setNewSessionName('');
      setCurrentInstance(null);
  }

  const handleStartProtocol = async (sessionNameOverride?: string) => {
      const nameToUse = sessionNameOverride || newSessionName;
      if(!nameToUse.trim()) return;
      
      setStep('initializing');
      setNewSessionName(nameToUse); // Garante que o input mostre o nome se for restart
      
      try {
          // Sanitiza nome para criar ID
          const sanitized = nameToUse.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          // Se for restart, usa o nome exato como ID se possível, ou gera novo se for criação
          const sessionId = sessionNameOverride ? sanitized : `${sanitized}-${Math.random().toString(36).substring(2, 6)}`;
          
          const newInstance = await whatsappService.connectInstance(sessionId, nameToUse);
          setCurrentInstance(newInstance);
          
          // Se já vier com QR (raro), atualiza
          if(newInstance.qrcode_url) setStep('qr_scan');

      } catch (error: any) {
          console.error(error);
          addToast({ type: 'error', title: 'Falha no Protocolo', message: error.message });
          setStep('input');
      }
  };

  // Função chamada pelo botão de Restart do Card
  const handleRestart = async (instance: Instance) => {
      // 1. Abre o modal
      setIsModalOpen(true);
      setStep('initializing');
      setNewSessionName(instance.name);
      
      try {
          // 2. Tenta fazer logout forçado primeiro para limpar o backend
          await whatsappService.logoutInstance(instance.session_id);
      } catch (e) {
          console.log("Erro ao limpar sessão antiga, continuando...", e);
      }

      // 3. Reinicia processo com o MESMO session_id para manter histórico se possível
      // Ou gera um novo se preferir limpar tudo. Aqui vamos recriar com o mesmo ID para tentar manter consistência.
      try {
          const newInstance = await whatsappService.connectInstance(instance.session_id, instance.name);
          setCurrentInstance(newInstance);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao reiniciar', message: error.message });
          setIsModalOpen(false);
      }
  };

  const limit = PLAN_LIMITS[(company?.plan as keyof typeof PLAN_LIMITS) || 'starter'] || 1;
  const usedSlots = instances.length;
  const availableSlots = limit - usedSlots;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
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
                <Button onClick={() => { resetModal(); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-primary/20">
                    <Plus className="w-5 h-5 mr-2" /> Nova Instância
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {instances.map((instance) => (
            <ConnectionCard 
                key={instance.id} 
                instance={instance} 
                refresh={fetchInstances} 
                onRestart={() => handleRestart(instance)}
            />
        ))}

        {Array.from({ length: Math.max(0, limit - instances.length) }).map((_, i) => (
             <div key={`empty-${i}`} className="group relative border border-dashed border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center bg-zinc-900/10 min-h-[400px] overflow-hidden hover:border-zinc-700 transition-all">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                    <Smartphone className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-lg font-bold text-zinc-500">Slot Disponível</h3>
                <Button variant="outline" onClick={() => { resetModal(); setIsModalOpen(true); }} className="mt-6 border-zinc-700 hover:bg-zinc-800 bg-transparent">
                    <Plus className="w-4 h-4 mr-2" /> Inicializar
                </Button>
             </div>
        ))}
      </div>

      {/* MODAL WIZARD DE CONEXÃO */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
            step === 'input' ? "Nova Conexão" : 
            step === 'success' ? "Conexão Estabelecida" :
            `Conectando: ${newSessionName}`
        }
        maxWidth="md"
      >
          <div className="min-h-[300px] flex flex-col justify-center">
              
              {/* STEP 1: INPUT */}
              {step === 'input' && (
                  <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 flex gap-3">
                          <Terminal className="w-5 h-5 text-primary mt-1" />
                          <div className="text-sm text-zinc-400">
                              <p className="font-bold text-zinc-200 mb-1">Identificador da Sessão</p>
                              Defina um nome para identificar este número (ex: "Vendas 01", "Suporte").
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
                      <div className="flex justify-end pt-4">
                          <Button onClick={() => handleStartProtocol()} disabled={!newSessionName.trim()} className="w-full">
                              Iniciar Protocolo de Conexão
                          </Button>
                      </div>
                  </div>
              )}

              {/* STEP 2: INITIALIZING (WAITING FOR QR) */}
              {step === 'initializing' && (
                  <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in">
                      <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                          <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white">Iniciando Servidor...</h3>
                          <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">
                              O sistema está preparando a instância segura do WhatsApp. O QR Code aparecerá em instantes.
                          </p>
                      </div>
                      <div className="w-full bg-zinc-900/50 rounded-full h-1.5 overflow-hidden max-w-[200px]">
                          <div className="h-full bg-primary animate-progress-indeterminate"></div>
                      </div>
                  </div>
              )}

              {/* STEP 3: QR SCAN */}
              {step === 'qr_scan' && currentInstance?.qrcode_url && (
                  <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <div className="relative group p-4 bg-white rounded-xl shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                          <QRCodeSVG
                              value={currentInstance.qrcode_url}
                              size={200}
                              level={"H"}
                              includeMargin={true}
                              className="w-56 h-56 object-contain"
                          />
                          <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan"></div>
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white mb-1">Escaneie com seu WhatsApp</h3>
                          <p className="text-zinc-500 text-xs font-mono bg-zinc-900 px-3 py-1 rounded inline-block">
                              Menu &gt; Aparelhos Conectados &gt; Conectar
                          </p>
                      </div>
                      {/* Status indicador */}
                      <div className="flex items-center gap-2 text-yellow-500 text-sm font-bold animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Aguardando leitura...
                      </div>
                  </div>
              )}

              {/* STEP 4: SUCCESS */}
              {step === 'success' && (
                  <div className="flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/50 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                          <CheckCircle2 className="w-12 h-12 text-green-500" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-white">Sincronizado!</h3>
                          <p className="text-zinc-400 mt-2">
                              A instância <strong>{currentInstance?.name}</strong> está online e pronta para uso.
                          </p>
                      </div>
                      <Button onClick={() => { setIsModalOpen(false); fetchInstances(); }} className="bg-zinc-800 hover:bg-zinc-700 text-white min-w-[150px]">
                          Fechar Janela
                      </Button>
                  </div>
              )}
          </div>
      </Modal>
    </div>
  );
}

// Card Atualizado com botão de Lixeira e Restart
const ConnectionCard: React.FC<{ instance: Instance, refresh: () => void, onRestart: () => void }> = ({ instance, refresh, onRestart }) => {
    const { addToast } = useToast();
    const [loadingAction, setLoadingAction] = useState(false);
    
    const handleDelete = async () => {
        if (!confirm(`TEM CERTEZA? Isso excluirá a instância "${instance.name}" e desconectará o WhatsApp.`)) return;
        setLoadingAction(true);
        try {
            await whatsappService.deleteInstance(instance.session_id);
            addToast({ type: 'success', title: 'Excluído', message: 'Instância removida com sucesso.' });
            refresh();
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setLoadingAction(false);
        }
    };

    const handleLogout = async () => {
         if (!confirm(`Desconectar sessão do WhatsApp?`)) return;
         setLoadingAction(true);
         try {
             await whatsappService.logoutInstance(instance.session_id);
             addToast({ type: 'success', title: 'Desconectado', message: 'Sessão encerrada.' });
             refresh();
         } catch (e: any) {
             addToast({ type: 'error', title: 'Erro', message: e.message });
         } finally {
             setLoadingAction(false);
         }
    };

    return (
        <div className="group bg-zinc-950/50 border border-zinc-800 hover:border-primary/30 rounded-2xl p-6 flex items-center justify-between transition-all">
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner relative",
                    instance.status === 'connected' ? 'bg-zinc-900 border-primary text-primary' : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                )}>
                    {instance.status === 'connected' ? <Wifi className="w-6 h-6" /> : <Power className="w-6 h-6" />}
                    {instance.status !== 'connected' && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-950 animate-pulse"></div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{instance.name}</h3>
                    <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", instance.status === 'connected' ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        <span className="text-xs text-zinc-500 uppercase font-mono">
                            {instance.status === 'qr_ready' ? 'AGUARDANDO LEITURA' : instance.status}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-2">
                {instance.status !== 'connected' && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onRestart} 
                        disabled={loadingAction} 
                        className="hover:bg-blue-500/10 hover:text-blue-500" 
                        title="Reiniciar Conexão / Gerar QR Code"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </Button>
                )}

                {instance.status === 'connected' && (
                    <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loadingAction} className="hover:bg-yellow-500/10 hover:text-yellow-500" title="Desconectar">
                        <Power className="w-5 h-5" />
                    </Button>
                )}
                
                <Button variant="ghost" size="icon" onClick={handleDelete} disabled={loadingAction} className="hover:bg-red-500/10 hover:text-red-500" title="Excluir Instância">
                    {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </Button>
            </div>
        </div>
    );
}
