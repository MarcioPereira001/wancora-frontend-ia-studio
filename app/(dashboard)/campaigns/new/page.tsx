'use client';

import React, { useState } from 'react';
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { TagSelector } from "@/components/crm/TagSelector";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";   
import { Textarea } from "@/components/ui/textarea"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { Rocket, Loader2, AlertTriangle, MessageSquare, Users } from "lucide-react";
import { createClient } from '@/utils/supabase/client';

export default function NewCampaignPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // 2. Access Control
  if (!user?.company_id) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-8 text-center bg-zinc-950">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-white">Acesso Restrito</h2>
        <p className="text-zinc-400">Não foi possível identificar a organização vinculada a este usuário.</p>
      </div>
    );
  }

  // 3. Launch Handler
  const handleLaunch = async () => {
    // Validação Básica
    if (!name.trim()) return addToast({ type: 'warning', title: "Atenção", message: "Dê um nome para a campanha." });
    if (!message.trim()) return addToast({ type: 'warning', title: "Atenção", message: "A mensagem não pode estar vazia." });
    if (targetTags.length === 0) return addToast({ type: 'warning', title: "Atenção", message: "Selecione pelo menos uma tag de destino." });

    setIsSending(true);

    try {
        // Primeiro, salvamos a campanha no Supabase como registro
        const { error: dbError } = await supabase.from('campaigns').insert({
            company_id: user.company_id,
            name: name,
            message_template: message,
            target_tags: targetTags,
            status: 'processing',
            execution_mode: 'standard'
        });

        if (dbError) throw dbError;

        // Depois, chamamos a API de envio do Backend
        // Payload corrigido para usar 'selectedTags' conforme contrato
        const payload = {
            companyId: user.company_id,
            name,
            selectedTags: targetTags, 
            message,
            scheduledAt: null // Envio Imediato
        };

        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api/v1";
        const safeBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const endpoint = `${safeBaseUrl}/campaigns/send`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "O servidor rejeitou o disparo.");
        }

        addToast({ type: 'success', title: "Sucesso!", message: `Processando ${data.leadsCount || 'vários'} envios.` });
        router.push("/dashboard"); 

    } catch (error: any) {
      console.error("Erro no disparo:", error);
      addToast({ type: 'error', title: "Erro de Conexão", message: error.message || "Falha ao conectar com o servidor de campanhas." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Rocket className="w-6 h-6 text-emerald-500" />
          </div>
          Nova Campanha
        </h1>
        <p className="text-zinc-400">
          Disparo em massa inteligente com atraso variável (15s-45s) para proteção do chip.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Step 1: Config & Alvos */}
        <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-cyan-500" />
              1. Configuração & Alvos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Nome Interno</label>
              <Input 
                placeholder="Ex: Oferta Relâmpago - Clientes VIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white focus:ring-emerald-500/20 focus:border-emerald-500 h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex justify-between">
                <span>Tags de Segmentação</span>
                <span className="text-xs text-zinc-500">Quem vai receber?</span>
              </label>
              <div className="p-5 rounded-lg border border-zinc-800 bg-zinc-950/50 min-h-[90px]">
                <TagSelector 
                  tags={targetTags} 
                  onChange={setTargetTags} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Mensagem */}
        <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              2. Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Olá! Temos uma condição especial para você hoje..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[180px] bg-zinc-950 border-zinc-800 text-white focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-sm leading-relaxed p-4 resize-y"
            />
            <div className="mt-2 text-xs text-zinc-500 flex justify-between">
              <span>Suporta formatação do WhatsApp (*negrito*, _itálico_)</span>
              <span>{message.length} caracteres</span>
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <div className="flex justify-end pt-2 pb-10">
          <Button 
            size="lg"
            onClick={handleLaunch}
            disabled={isSending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base px-8 h-12 shadow-[0_0_25px_-5px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Iniciando Protocolo...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-5 w-5" />
                LANÇAR CAMPANHA AGORA
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}