
'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Loader2, Battery, Power, Trash2, RefreshCw, CheckCircle2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { whatsappService } from '@/services/whatsappService';
import { useToast } from '@/hooks/useToast';
import { useRealtimeStore } from '@/store/useRealtimeStore';

export function ConnectionStatus() {
  const { addToast } = useToast();
  const { instances } = useRealtimeStore(); // Conectado à Store Global
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Pega a instância mais recente ou a primeira disponível
  const instance = instances.find(i => i.status === 'connected') || instances[0];

  const handleConnect = async () => {
    setLoadingAction(true);
    try {
        const sessionId = instance?.session_id || 'default';
        await whatsappService.connectInstance(sessionId, instance?.name);
        addToast({ type: 'info', title: 'Iniciando', message: 'Solicitando QR Code ao servidor...' });
    } catch (e: any) {
        addToast({ type: 'error', title: 'Erro', message: e.message });
    } finally {
        setLoadingAction(false);
    }
  };

  const handleLogout = async () => {
    if (!instance) return;
    if (!confirm("Desconectar o WhatsApp?")) return;
    setLoadingAction(true);
    try {
        await whatsappService.logoutInstance(instance.session_id);
    } catch (e: any) {
        addToast({ type: 'error', title: 'Erro', message: e.message });
    } finally {
        setLoadingAction(false);
    }
  };

  const renderContent = () => {
    const status = instance?.status || 'disconnected';
    const isSyncing = instance?.sync_status && instance.sync_status !== 'completed';

    // 1. Loading / Conectando / Sincronizando
    if (loadingAction || status === 'connecting' || isSyncing || isSyncingManual) {
      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in">
          <div className="relative">
             <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
             <Loader2 className="w-12 h-12 text-green-500 animate-spin relative z-10" />
          </div>
          <div className="text-center">
            <p className="text-zinc-400 text-sm animate-pulse font-medium">
                {isSyncing ? "Sincronizando Mensagens..." : "Aguardando Conexão..."}
            </p>
            {isSyncing && instance.sync_percent !== undefined && (
                <span className="text-xs font-mono text-primary mt-1 block">{instance.sync_percent}%</span>
            )}
          </div>
        </div>
      );
    }

    // 2. Conectado
    if (status === 'connected') {
      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
           <div className="relative group">
              <img 
                src={instance?.profile_pic_url || 'https://via.placeholder.com/150'} 
                className="w-24 h-24 rounded-full border-2 border-green-500 p-1 shadow-[0_0_30px_rgba(34,197,94,0.3)] object-cover bg-zinc-950"
                alt="Avatar"
              />
              <div className="absolute -bottom-1 -right-1 bg-zinc-950 p-1.5 rounded-full border border-zinc-800">
                <Battery className={cn("w-4 h-4", (instance?.battery_level || 0) < 20 ? "text-red-500" : "text-green-400")} />
              </div>
           </div>
           <div className="text-center space-y-1">
              <p className="text-white font-bold text-lg flex items-center justify-center gap-2">
                  {instance?.name || 'WhatsApp'}
                  {instance.is_business_account && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="WhatsApp Business">
                          <Briefcase className="w-3 h-3" /> BIZ
                      </span>
                  )}
              </p>
              <div className="flex items-center gap-2 justify-center text-zinc-400 text-sm mt-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-500 font-medium">Online e Operante</span>
              </div>
           </div>
        </div>
      );
    }

    // 3. QR Code
    if ((status === 'qr_ready' || status === 'qrcode') && instance?.qrcode_url) {
      return (
        <div className="text-center space-y-4 animate-in fade-in zoom-in">
          <div className="p-4 bg-white rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.15)] relative mx-auto w-fit group border-4 border-white">
             <QRCodeSVG 
                value={instance.qrcode_url}
                size={160}
                level="L"
                includeMargin={false}
             />
             <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
          </div>
          <div>
            <p className="text-emerald-400 text-xs font-mono font-bold tracking-widest animate-pulse">
                ESCANEIE AGORA
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">Abra WhatsApp &gt; Aparelhos Conectados</p>
          </div>
        </div>
      );
    }

    // 4. Desconectado
    return (
      <div className="text-center space-y-4 animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-2 border border-zinc-700 shadow-inner">
          <Power className="w-8 h-8 text-zinc-600" />
        </div>
        <button 
          onClick={handleConnect}
          disabled={loadingAction}
          className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2 mx-auto active:scale-95 disabled:opacity-50"
        >
          {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "INICIAR CONEXÃO"}
        </button>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden transition-all duration-500 hover:border-zinc-700 group min-h-[320px] flex flex-col justify-between border border-zinc-800 bg-zinc-900/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg transition-colors duration-300 border",
            instance?.status === 'connected' ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"
          )}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold tracking-tight text-sm">Dispositivo</h3>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest opacity-70">
              {instance?.session_id ? instance.session_id.slice(0,12) : 'OFFLINE'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className={cn(
            "flex items-center gap-2 text-[10px] font-bold px-3 py-1 rounded-full border transition-all duration-300",
            instance?.status === 'connected' ? "text-green-400 bg-green-500/10 border-green-500/20" : 
            (instance?.status === 'connecting') ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
            "text-zinc-500 bg-zinc-900 border-zinc-800"
            )}>
            {(instance?.status === 'connecting') && <RefreshCw className="w-3 h-3 animate-spin" />}
            {(instance?.status || 'DISCONNECTED').toUpperCase()}
            </div>

            {instance?.status === 'connected' && (
                <button 
                onClick={handleLogout}
                title="Desconectar"
                disabled={loadingAction}
                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-500 transition-colors"
                >
                <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="flex-1 flex items-center justify-center w-full">
        {renderContent()}
      </div>
    </div>
  );
}
