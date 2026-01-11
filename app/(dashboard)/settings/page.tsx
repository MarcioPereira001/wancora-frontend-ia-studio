'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Smartphone, RefreshCw, Power, CheckCircle, AlertCircle, Loader2, CreditCard, Building, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';
import { Instance } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function SettingsPage() {
  const { addToast } = useToast();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'company'>('whatsapp');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicia Polling quando a aba WhatsApp está ativa
  useEffect(() => {
    const loadStatus = async () => {
        const data = await whatsappService.getInstanceStatus();
        setInstance(data);
    };

    if (activeTab === 'whatsapp') {
      loadStatus();
      pollingRef.current = setInterval(async () => {
          await loadStatus();
      }, 3000); 
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeTab]);

  const handleConnect = async () => {
    setLoading(true);
    try {
        await whatsappService.connectInstance();
        addToast({
            type: 'info',
            title: 'Iniciando Conexão',
            message: 'Aguarde, estamos gerando o QR Code com o servidor...'
        });
    } catch (e: any) {
        addToast({
            type: 'error',
            title: 'Erro ao conectar',
            message: e.message || 'Verifique se o backend está online.'
        });
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp? Isso parará os fluxos de IA.")) return;
    setLoading(true);
    try {
        await whatsappService.logoutInstance();
        setInstance(prev => prev ? { ...prev, status: 'disconnected', qrcode_url: undefined } : null);
        addToast({
            type: 'success',
            title: 'Desconectado',
            message: 'A sessão do WhatsApp foi encerrada.'
        });
    } catch (e: any) {
        addToast({
            type: 'error',
            title: 'Erro ao desconectar',
            message: e.message
        });
    } finally {
        setLoading(false);
    }
  };

  const renderQrCode = () => {
    if (!instance?.qrcode_url) return null;

    const src = instance.qrcode_url.startsWith('data:image') 
        ? instance.qrcode_url 
        : `data:image/png;base64,${instance.qrcode_url}`;

    return (
        <div className="bg-white p-4 rounded-xl inline-block shadow-2xl animate-in zoom-in duration-300">
            <img 
                src={src} 
                alt="Scan Me" 
                className="w-64 h-64 object-contain"
            />
        </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-zinc-400 text-sm">Gerencie a conexão com a API Baileys.</p>
      </div>

      <div className="flex border-b border-zinc-800">
        <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'whatsapp' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
        >
            Conexão WhatsApp
        </button>
        <button
            onClick={() => setActiveTab('company')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'company' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
        >
            Empresa & Plano
        </button>
      </div>

      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-zinc-400" />
                        Status da Sessão
                    </h3>

                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                            instance?.status === 'connected' ? 'border-green-500 bg-green-500/10' : 
                            instance?.status === 'qr_ready' || instance?.status === 'connecting' ? 'border-yellow-500 bg-yellow-500/10' :
                            'border-red-500 bg-red-500/10'
                        }`}>
                            {instance?.status === 'connected' ? (
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            ) : instance?.status === 'qr_ready' || instance?.status === 'connecting' ? (
                                <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                            ) : (
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            )}
                        </div>
                        <div>
                            <h4 className="font-medium text-white text-lg">
                                {instance?.status === 'connected' ? 'Online' : 
                                 instance?.status === 'qr_ready' ? 'Lendo QR Code' : 
                                 instance?.status === 'connecting' ? 'Iniciando...' :
                                 'Desconectado'}
                            </h4>
                            <p className="text-sm text-zinc-400">
                                {instance?.status === 'connected' 
                                    ? `Sessão: ${instance.name || 'Padrão'}` 
                                    : 'O sistema precisa estar conectado para operar.'}
                            </p>
                            {instance?.battery_level !== undefined && instance.battery_level !== null && (
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="w-6 h-3 border border-zinc-600 rounded-sm p-0.5 relative">
                                        <div 
                                            className="h-full bg-green-500 rounded-[1px]" 
                                            style={{ width: `${instance.battery_level}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-zinc-500">{instance.battery_level}%</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {instance?.status === 'connected' ? (
                            <Button variant="destructive" onClick={handleLogout} isLoading={loading} className="w-full">
                                <Power className="w-4 h-4 mr-2" />
                                Desconectar Sessão
                            </Button>
                        ) : (
                            <Button 
                                variant="default" 
                                onClick={handleConnect} 
                                isLoading={loading || instance?.status === 'connecting'} 
                                className="w-full"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                {instance?.status === 'qr_ready' ? 'Gerar Novo QR' : 'Iniciar Conexão'}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Loader2 className="w-5 h-5 text-primary mt-0.5 animate-spin-slow" />
                        <div>
                            <h4 className="text-zinc-200 font-medium text-sm">Sincronização em Tempo Real</h4>
                            <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                                O Wancora mantém uma conexão WebSocket ativa com o Render. 
                                Mensagens enviadas e recebidas são salvas instantaneamente no Supabase.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Code Area */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center p-8 min-h-[400px] relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                {instance?.status === 'connected' ? (
                    <div className="text-center space-y-4 relative z-10 animate-in fade-in zoom-in duration-500">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                            <Smartphone className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-white font-medium text-lg">WhatsApp Sincronizado</h3>
                        <p className="text-zinc-500 max-w-xs mx-auto text-sm">
                            Você já pode fechar esta tela. O CRM está pronto para enviar e receber mensagens.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => window.location.hash = '#/inbox'}>
                            Ir para o Chat <ExternalLink className="w-3 h-3 ml-2" />
                        </Button>
                    </div>
                ) : instance?.qrcode_url ? (
                    <div className="text-center space-y-6 relative z-10">
                        {renderQrCode()}
                        <div>
                            <p className="text-white font-medium mb-1">Escaneie com seu WhatsApp</p>
                            <p className="text-zinc-500 text-xs">Menu {'>'} Aparelhos conectados {'>'} Conectar aparelho</p>
                        </div>
                        <p className="text-xs text-yellow-500/80 animate-pulse">
                            O QR Code expira em 40 segundos...
                        </p>
                    </div>
                ) : (
                    <div className="text-center text-zinc-600 relative z-10">
                        <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-zinc-500">
                            {instance?.status === 'connecting' 
                                ? 'Solicitando QR Code ao servidor...' 
                                : 'Clique em "Iniciar Conexão" para gerar o QR Code.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'company' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <Building className="w-5 h-5 text-zinc-400" />
                      Dados da Empresa
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-semibold">Nome da Empresa</label>
                          <input type="text" value="Wancora Tech Ltda" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-300 mt-1 cursor-not-allowed opacity-70" />
                      </div>
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-semibold">ID do Tenant (Supabase)</label>
                          <input type="text" value="wancora_default_tenant" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-500 mt-1 font-mono text-xs cursor-not-allowed opacity-70" />
                      </div>
                  </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-zinc-400" />
                      Assinatura
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 mb-4">
                      <div>
                          <p className="text-sm text-zinc-400">Plano Atual</p>
                          <h4 className="text-xl font-bold text-white">Profissional</h4>
                      </div>
                      <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]">ATIVO</span>
                  </div>
                  <Button variant="outline" className="w-full hover:bg-zinc-800">Gerenciar Cobrança (Stripe)</Button>
              </div>
          </div>
      )}
    </div>
  );
}