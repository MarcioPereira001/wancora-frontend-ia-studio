'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { WhatsAppInstance } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smartphone, RefreshCw, Power, CheckCircle, AlertCircle } from 'lucide-react';
import { whatsappService } from '@/services/whatsappService';

export default function ConnectionsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) return;
    
    // Busca inicial
    const fetchStatus = async () => {
        const data = await whatsappService.getInstanceStatus();
        setInstance(data);
        setLoading(false);
    };
    fetchStatus();

    // Polling de 3 segundos para atualizar o QR Code ou status
    const interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, [user]);

  const handleConnect = async () => {
      if (!instance?.session_id) {
          await whatsappService.connectInstance('default');
      } else {
          await whatsappService.connectInstance(instance.session_id);
      }
  };

  const handleLogout = async () => {
      if(instance?.session_id) {
          await whatsappService.logoutInstance(instance.session_id);
          setInstance(prev => prev ? {...prev, status: 'disconnected', qrcode_url: undefined} : null);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Conexões</h1>
        <p className="text-zinc-400">Gerencie sua instância do WhatsApp (Baileys).</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="glass border-zinc-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-zinc-400" /> Status da Sessão
                </CardTitle>
                <CardDescription>Monitoramento em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 transition-colors ${
                        instance?.status === 'connected' ? 'border-green-500 bg-green-500/10' : 
                        instance?.status === 'connecting' || instance?.status === 'qr_ready' ? 'border-yellow-500 bg-yellow-500/10' :
                        'border-red-500 bg-red-500/10'
                    }`}>
                        {instance?.status === 'connected' ? <CheckCircle className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">
                            {instance?.status === 'connected' ? 'Conectado' : 
                             instance?.status === 'qr_ready' ? 'Aguardando Leitura' : 
                             instance?.status === 'connecting' ? 'Iniciando...' : 'Desconectado'}
                        </h3>
                        <p className="text-sm text-zinc-500">{instance?.session_id || 'Padrão'}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {instance?.status !== 'connected' ? (
                        <Button variant="outline" className="w-full" onClick={handleConnect} disabled={instance?.status === 'connecting'}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${instance?.status === 'connecting' ? 'animate-spin' : ''}`} /> 
                            {instance?.status === 'connecting' ? 'Conectando...' : 'Iniciar Conexão'}
                        </Button>
                    ) : (
                        <Button variant="destructive" className="w-full" onClick={handleLogout}>
                            <Power className="mr-2 h-4 w-4" /> Desconectar
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>

        {instance?.status !== 'connected' && (
            <Card className="bg-white text-black border-none">
                <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                    {instance?.qrcode_url ? (
                        <img src={instance.qrcode_url.startsWith('data') ? instance.qrcode_url : `data:image/png;base64,${instance.qrcode_url}`} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                    ) : (
                        <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded text-sm text-gray-500 animate-pulse">
                            {instance?.status === 'connecting' ? 'Gerando QR Code...' : 'Aguardando ação...'}
                        </div>
                    )}
                    <div className="text-center">
                        <p className="font-bold">Escaneie com seu WhatsApp</p>
                        <p className="text-sm text-gray-500">Menu &gt; Aparelhos Conectados &gt; Conectar</p>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}