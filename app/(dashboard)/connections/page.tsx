'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { WhatsAppInstance } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smartphone, RefreshCw, Power, CheckCircle, AlertCircle } from 'lucide-react';

export default function ConnectionsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Polling simulation for status updates
    const interval = setInterval(async () => {
        const { data } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', user.company_id)
            .single();
        
        if (data) setInstance(data);
        setLoading(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [user, supabase]);

  const handleConnect = async () => {
      // Mock action
      alert("Comando enviado: Iniciar Sessão");
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
                    <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 ${
                        instance?.status === 'connected' ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
                    }`}>
                        {instance?.status === 'connected' ? <CheckCircle className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">
                            {instance?.status === 'connected' ? 'Conectado' : 
                             instance?.status === 'qr_ready' ? 'Aguardando Leitura' : 'Desconectado'}
                        </h3>
                        <p className="text-sm text-zinc-500">{instance?.session_id || 'Padrão'}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="w-full" onClick={handleConnect}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Reconectar
                    </Button>
                    <Button variant="destructive" className="w-full">
                        <Power className="mr-2 h-4 w-4" /> Desconectar
                    </Button>
                </div>
            </CardContent>
        </Card>

        {instance?.status !== 'connected' && (
            <Card className="bg-white text-black border-none">
                <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                    {instance?.qrcode ? (
                        <img src={instance.qrcode} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                    ) : (
                        <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded text-sm text-gray-500">
                            Aguardando QR Code...
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