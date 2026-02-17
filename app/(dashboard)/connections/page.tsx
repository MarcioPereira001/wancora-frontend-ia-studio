
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, RefreshCw, Power, Trash2, Wifi, Terminal, MessageCircle, CheckCircle2, Loader2, Plus, RotateCcw, Webhook, Save, Briefcase, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';
import { Instance } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useCompany } from '@/hooks/useCompany';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/utils/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { useRealtimeStore } from '@/store/useRealtimeStore';

const PLAN_LIMITS = {
  starter: 1,
  pro: 3,
  scale: 10
};

export default function ConnectionsPage() {
  const { addToast } = useToast();
  const { company } = useCompany();
  const { triggerSyncAnimation } = useRealtimeStore();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Unificado 'setup' substitui 'business_check' e 'input' separados
  const [step, setStep] = useState<'setup' | 'initializing' | 'qr_scan' | 'success'>('setup');
  
  const [newSessionName, setNewSessionName] = useState('');
  const [isBusinessConfirmed, setIsBusinessConfirmed] = useState(false); // Novo Checkbox
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(null);

  // Webhook Modal State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  const fetchInstances = async () => {
      try {
          const data = await whatsappService.getAllInstances();
          setInstances(data);
      } catch (error) {
          console.error(error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchInstances();
    if (!company?.id) return;

    const channel = supabase
      .channel('instances-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instances', filter: `company_id=eq.${company.id}` }, 
        () => fetchInstances()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [company?.id, supabase]);

  // Polling e QR Code
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isModalOpen || !currentInstance?.session_id) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
    }

    const checkStatus = async () => {
        const status = await whatsappService.getInstanceStatus(currentInstance.session_id);
        if (!status) return;
        setCurrentInstance(status);

        if (status.status === 'connected') {
            setStep('success');
            
            // FIX RECONEXÃO: Só dispara a animação de sync se NÃO estiver completo.
            if(status.id && status.sync_status !== 'completed') {
                triggerSyncAnimation(status.id);
            }
            
            if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (status.qrcode_url && status.qrcode_url.length > 10) {
            setStep('qr_scan');
        }
    };

    checkStatus();
    intervalRef.current = setInterval(checkStatus, 2000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isModalOpen, currentInstance?.session_id, triggerSyncAnimation]);

  const resetModal = () => {
      setStep('setup');
      setNewSessionName('');
      setIsBusinessConfirmed(false);
      setCurrentInstance(null);
  }

  const handleStartProtocol = async (sessionNameOverride?: string, sessionIdOverride?: string) => {
      const nameToUse = sessionNameOverride || newSessionName;
      if(!nameToUse.trim()) return;
      
      setStep('initializing');
      if(sessionNameOverride) setNewSessionName(sessionNameOverride);
      
      try {
          let sessionId = sessionIdOverride;
          if (!sessionId) {
            const sanitized = nameToUse.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            sessionId = `${sanitized}-${Math.random().toString(36).substring(2, 6)}`;
          }
          
          const newInstance = await whatsappService.connectInstance(sessionId, nameToUse);
          setCurrentInstance(newInstance);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Falha', message: error.message });
          setStep('setup');
      }
  };

  const handleRestart = async (instance: Instance) => {
      setIsModalOpen(true);
      setStep('initializing');
      setNewSessionName(instance.name);
      setCurrentInstance(instance);
      
      try {
          await whatsappService.logoutInstance(instance.session_id);
      } catch (e) {}

      setTimeout(() => {
          handleStartProtocol(instance.name, instance.session_id);
      }, 1000);
  };

  const openWebhookModal = async (instance: Instance) => {
      const { data } = await supabase.from('instances').select('webhook_url, webhook_enabled').eq('id', instance.id).single();
      setWebhookUrl(data?.webhook_url || '');
      setWebhookEnabled(data?.webhook_enabled || false);
      setEditingInstanceId(instance.id);
      setIsWebhookModalOpen(true);
  };

  const saveWebhook = async () => {
      if(!editingInstanceId) return;
      
      const { error } = await supabase.from('instances').update({
          webhook_url: webhookUrl,
          webhook_enabled: webhookEnabled
      }).eq('id', editingInstanceId);

      if (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao salvar webhook.' });
      } else {
          addToast({ type: 'success', title: 'Salvo', message: 'Configuração de webhook atualizada.' });
          setIsWebhookModalOpen(false);
      }
  };

  const limit = PLAN_LIMITS[(company?.plan as keyof typeof PLAN_LIMITS) || 'starter'] || 1;
  const usedSlots = instances.length;
  const availableSlots = limit - usedSlots;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
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
                {loading ? (
                    <span className="inline-block w-4 h-4 align-middle"><Loader2 className="w-3 h-3 animate-spin" /></span>
                ) : (
                    <span className={cn("font-bold", availableSlots > 0 ? "text-primary" : "text-red-500")}>
                        {usedSlots} / {limit}
                    </span>
                )}
            </div>
            {/* Proteção contra clique antes de carregar (Flash of Opportunity) */}
            {!loading && availableSlots > 0 && (
                <Button onClick={() => { resetModal(); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-primary/20">
                    <Plus className="w-5 h-5 mr-2" /> Nova Instância
                </Button>
            )}
        </div>
      </div>

      {/* BLOCKING LOADER: O Grid só renderiza se não estiver carregando */}
      {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 bg-zinc-900/10 rounded-2xl border border-zinc-800 border-dashed">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-zinc-500 text-sm animate-pulse">Verificando slots disponíveis...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {instances.map((instance) => (
                <ConnectionCard 
                    key={instance.id} 
                    instance={instance} 
                    refresh={fetchInstances} 
                    onRestart={() => handleRestart(instance)}
                    onWebhook={() => openWebhookModal(instance)}
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
      )}

      {/* MODAL DE CONEXÃO REFORMULADO */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
            step === 'setup' ? "Nova Conexão" : 
            step === 'success' ? "Conexão Estabelecida" : 
            step === 'qr_scan' ? "Escaneie o QR Code" : 
            `Conectando: ${newSessionName}`
        }
        maxWidth="md"
      >
          <div className="min-h-[350px] flex flex-col justify-center">
              
              {/* PASSO 1 UNIFICADO: SETUP (Info Business + Nome) */}
              {step === 'setup' && (
                  <div className="space-y-6 animate-in slide-in-from-right-4">
                      
                      {/* Bloco de Aviso Business */}
                      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-500/20 rounded-full">
                                  <Briefcase className="w-5 h-5 text-blue-400" />
                              </div>
                              <h4 className="text-sm font-bold text-blue-200">Recomendação de Segurança</h4>
                          </div>
                          
                          <div className="space-y-2 pl-1">
                              <div className="flex items-start gap-2">
                                  <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                  <p className="text-xs text-zinc-300">Menor risco de bloqueio (Ban) pela Meta.</p>
                              </div>
                              <div className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                  <p className="text-xs text-zinc-300">Suporte a Catálogo, Etiquetas e Horários.</p>
                              </div>
                              <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                                  <p className="text-xs text-zinc-300">Números pessoais tem limites de envio muito baixos.</p>
                              </div>
                          </div>
                      </div>

                      {/* Input de Nome */}
                      <div>
                          <label className="text-xs font-bold text-white uppercase mb-2 block tracking-wider">Identificador da Sessão</label>
                          <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800 focus-within:border-primary transition-colors">
                              <Terminal className="w-5 h-5 text-zinc-500" />
                              <input 
                                  value={newSessionName} 
                                  onChange={e => setNewSessionName(e.target.value)}
                                  placeholder="Ex: Vendas 01" 
                                  className="bg-transparent border-none outline-none text-white text-sm w-full font-medium"
                                  autoFocus
                              />
                          </div>
                      </div>

                      {/* Checkbox de Confirmação */}
                      <div className="flex items-start gap-3 px-1">
                           <Checkbox 
                                id="biz-check"
                                checked={isBusinessConfirmed}
                                onCheckedChange={(checked) => setIsBusinessConfirmed(checked === true)}
                                className="mt-0.5 border-zinc-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                           />
                           <label htmlFor="biz-check" className="text-xs text-zinc-400 cursor-pointer leading-relaxed select-none">
                               Estou ciente que o uso de <strong>WhatsApp Business</strong> é recomendado para evitar bloqueios e garantir estabilidade da API.
                           </label>
                      </div>

                      <div className="pt-2">
                          <Button 
                              onClick={() => handleStartProtocol()} 
                              disabled={!newSessionName.trim() || !isBusinessConfirmed} 
                              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 shadow-lg shadow-green-500/10 disabled:opacity-50"
                          >
                              Gerar QR Code
                          </Button>
                      </div>
                  </div>
              )}

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
                  </div>
              )}

              {step === 'qr_scan' && currentInstance?.qrcode_url && (
                  <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <div className="relative group p-4 bg-white rounded-xl shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                          <QRCodeSVG value={currentInstance.qrcode_url} size={220} level={"L"} includeMargin={true} />
                          <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan"></div>
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white mb-1">Abra seu WhatsApp e Escaneie</h3>
                          <div className="text-zinc-500 text-xs font-mono bg-zinc-900 px-3 py-2 rounded mt-2 inline-block text-left">
                              1. Configurações (iOS) ou Mais Opções (Android)<br/>
                              2. Aparelhos conectados &gt; Conectar um aparelho
                          </div>
                      </div>
                  </div>
              )}

              {step === 'success' && (
                  <div className="flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/50">
                          <CheckCircle2 className="w-12 h-12 text-green-500" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-white">Sincronizado!</h3>
                          <p className="text-zinc-400 mt-2">A instância está online.</p>
                      </div>
                      <Button onClick={() => { setIsModalOpen(false); fetchInstances(); }} className="bg-zinc-800 text-white min-w-[150px]">Fechar</Button>
                  </div>
              )}
          </div>
      </Modal>

      {/* MODAL DE WEBHOOK */}
      <Modal 
        isOpen={isWebhookModalOpen} 
        onClose={() => setIsWebhookModalOpen(false)} 
        title="Configuração de Webhook"
        maxWidth="md"
      >
          <div className="space-y-6 py-2">
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 text-sm text-zinc-400 leading-relaxed">
                  <p className="mb-2"><strong className="text-white">Integração Externa:</strong> Envie notificações de novas mensagens para outros sistemas (n8n, Typebot, Zapier).</p>
                  <p className="text-xs font-mono bg-zinc-950 p-2 rounded border border-zinc-800">
                      POST Payload: {"{"} event: "message.upsert", data: {"{"} ...msg {"}"} {"}"}
                  </p>
              </div>

              <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">URL de Destino (Endpoint)</label>
                  <Input 
                      value={webhookUrl} 
                      onChange={e => setWebhookUrl(e.target.value)} 
                      placeholder="https://seu-n8n.com/webhook/..." 
                      className="bg-zinc-950 border-zinc-800"
                  />
              </div>

              <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <span className="text-sm font-medium text-white">Ativar Webhook</span>
                  <div 
                      onClick={() => setWebhookEnabled(!webhookEnabled)}
                      className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", webhookEnabled ? "bg-green-600" : "bg-zinc-700")}
                  >
                      <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", webhookEnabled ? "left-6" : "left-1")} />
                  </div>
              </div>

              <div className="flex justify-end pt-4">
                  <Button onClick={saveWebhook} className="bg-primary hover:bg-primary/90 text-white">
                      <Save className="w-4 h-4 mr-2" /> Salvar Configuração
                  </Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}

const ConnectionCard: React.FC<{ instance: Instance, refresh: () => void, onRestart: () => void, onWebhook: () => void }> = ({ instance, refresh, onRestart, onWebhook }) => {
    const { addToast } = useToast();
    const [loadingAction, setLoadingAction] = useState(false);
    
    const handleDelete = async () => {
        if (!confirm(`TEM CERTEZA? Isso excluirá a instância e todas as chaves de criptografia. Os dados de leads serão mantidos.`)) return;
        setLoadingAction(true);
        try {
            await whatsappService.deleteInstance(instance.session_id);
            addToast({ type: 'success', title: 'Excluído', message: 'Instância removida com sucesso. Conecte novamente.' });
            refresh();
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setLoadingAction(false);
        }
    };

    const handleLogout = async () => {
         if (!confirm(`Desconectar sessão?`)) return;
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
        <div className="group bg-zinc-950/50 border border-zinc-800 hover:border-primary/30 rounded-2xl p-6 flex flex-col gap-4 transition-all">
            <div className="flex items-center justify-between w-full">
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
                                {instance.status === 'connected' ? 'ONLINE' : instance.qrcode_url ? 'QR CODE PRONTO' : 'DESCONECTADO'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onWebhook}
                        disabled={loadingAction}
                        className="hover:bg-purple-500/10 hover:text-purple-500" 
                        title="Configurar Webhook"
                    >
                        <Webhook className="w-5 h-5" />
                    </Button>

                    {instance.status !== 'connected' && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onRestart} 
                            disabled={loadingAction} 
                            className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-400 border border-blue-500/20" 
                            title="Reiniciar Conexão"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </Button>
                    )}

                    {instance.status === 'connected' && (
                        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loadingAction} className="hover:bg-yellow-500/10 hover:text-yellow-500" title="Desconectar">
                            <Power className="w-5 h-5" />
                        </Button>
                    )}
                    
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={loadingAction} className="hover:bg-red-500/10 hover:text-red-500" title="Excluir (Resetar Chaves)">
                        {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </Button>
                </div>
            </div>

            {/* ALERTA VISUAL PARA ERRO DE CRIPTOGRAFIA */}
            {instance.status === 'disconnected' && (
                 <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 items-start animate-in slide-in-from-top-2">
                     <AlertTriangle className="w-5 h-5 text-red-500/80 shrink-0 mt-0.5" />
                     <div className="text-xs text-zinc-400">
                         <strong className="text-red-400 block mb-1">Problemas de Conexão?</strong>
                         Se o QR Code não gerar ou a conexão falhar repetidamente, clique no botão de <strong>Excluir</strong> (<Trash2 className="w-3 h-3 inline text-red-400"/>) acima. 
                         Isso reseta as chaves de criptografia corrompidas <strong>sem apagar</strong> seus Leads ou Conversas.
                     </div>
                 </div>
            )}
        </div>
    );
}
