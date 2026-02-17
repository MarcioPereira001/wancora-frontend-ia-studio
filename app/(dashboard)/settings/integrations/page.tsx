
'use client';

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/hooks/useCompany';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, Loader2, Key, Eye, EyeOff, Plug, CreditCard, Mic2, Code2, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IntegrationsPage() {
  const { company, isLoading } = useCompany();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  
  // Estado local das configs
  const [config, setConfig] = useState({
      openai_key: '',
      elevenlabs_key: '',
      stripe_pk: '',
      stripe_sk: '',
      n8n_webhook: '',
      typebot_url: ''
  });

  useEffect(() => {
      if (company?.integrations_config) {
          const c = company.integrations_config as any;
          setConfig({
              openai_key: c.openai?.apiKey || '',
              elevenlabs_key: c.elevenlabs?.apiKey || '',
              stripe_pk: c.stripe?.publishableKey || '',
              stripe_sk: c.stripe?.secretKey || '',
              n8n_webhook: c.n8n?.url || '',
              typebot_url: c.typebot?.url || ''
          });
      }
  }, [company]);

  const toggleVisibility = (field: string) => {
      setVisibleKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
      if (!company?.id) return;
      setSaving(true);
      
      try {
          const payload = {
              openai: { apiKey: config.openai_key },
              elevenlabs: { apiKey: config.elevenlabs_key },
              stripe: { publishableKey: config.stripe_pk, secretKey: config.stripe_sk },
              n8n: { url: config.n8n_webhook },
              typebot: { url: config.typebot_url },
              updated_at: new Date().toISOString()
          };

          const { error } = await supabase
              .from('companies')
              .update({ integrations_config: payload })
              .eq('id', company.id);

          if (error) throw error;
          addToast({ type: 'success', title: 'Salvo', message: 'Integrações atualizadas com sucesso.' });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally {
          setSaving(false);
      }
  };

  const IntegrationCard = ({ icon: Icon, title, desc, children, color }: any) => (
      <Card className="bg-zinc-900/40 border-zinc-800 overflow-hidden">
          <CardHeader className="border-b border-zinc-800/50 bg-zinc-900/20 pb-4">
              <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-opacity-10 border border-white/5", color.bg, color.text)}>
                      <Icon className="w-5 h-5" />
                  </div>
                  <div>
                      <CardTitle className="text-base text-zinc-100">{title}</CardTitle>
                      <CardDescription className="text-xs text-zinc-500">{desc}</CardDescription>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
              {children}
          </CardContent>
      </Card>
  );

  const KeyInput = ({ label, value, fieldKey, placeholder }: any) => (
      <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">{label}</label>
          <div className="relative">
              <Input 
                  type={visibleKeys[fieldKey] ? "text" : "password"} 
                  value={value}
                  onChange={(e) => setConfig({ ...config, [fieldKey]: e.target.value })}
                  placeholder={placeholder}
                  className="bg-zinc-950 border-zinc-800 pr-10 font-mono text-xs"
              />
              <button 
                  onClick={() => toggleVisibility(fieldKey)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  type="button"
              >
                  {visibleKeys[fieldKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
          </div>
      </div>
  );

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-zinc-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-20">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Plug className="w-6 h-6 text-pink-500" /> Central de Integrações
                </h1>
                <p className="text-zinc-400 text-sm mt-1">Conecte ferramentas externas para turbinar seus agentes (BYOK).</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Chaves
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IA & LLM */}
            <IntegrationCard 
                icon={Code2} 
                title="Inteligência Artificial (Extra)" 
                desc="Chaves opcionais para modelos de fallback ou específicos."
                color={{ bg: "bg-green-500", text: "text-green-500" }}
            >
                <KeyInput 
                    label="OpenAI API Key (GPT-4)" 
                    value={config.openai_key} 
                    fieldKey="openai_key" 
                    placeholder="sk-..." 
                />
            </IntegrationCard>

            {/* Voz & Áudio */}
            <IntegrationCard 
                icon={Mic2} 
                title="Voz & Clonagem" 
                desc="Necessário para agentes que enviam áudio."
                color={{ bg: "bg-purple-500", text: "text-purple-500" }}
            >
                <KeyInput 
                    label="ElevenLabs API Key" 
                    value={config.elevenlabs_key} 
                    fieldKey="elevenlabs_key" 
                    placeholder="xi-..." 
                />
            </IntegrationCard>

            {/* Automação */}
            <IntegrationCard 
                icon={Webhook} 
                title="Webhooks & Automação" 
                desc="Disparos de eventos para workflows externos."
                color={{ bg: "bg-blue-500", text: "text-blue-500" }}
            >
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">N8N Webhook URL</label>
                    <Input 
                        value={config.n8n_webhook}
                        onChange={(e) => setConfig({ ...config, n8n_webhook: e.target.value })}
                        placeholder="https://seu-n8n.com/webhook/..."
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Typebot Viewer URL</label>
                    <Input 
                        value={config.typebot_url}
                        onChange={(e) => setConfig({ ...config, typebot_url: e.target.value })}
                        placeholder="https://viewer.typebot.io/..."
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs"
                    />
                </div>
            </IntegrationCard>

            {/* Pagamentos */}
            <IntegrationCard 
                icon={CreditCard} 
                title="Pagamentos (Stripe)" 
                desc="Para gerar links de pagamento no chat."
                color={{ bg: "bg-indigo-500", text: "text-indigo-500" }}
            >
                <KeyInput 
                    label="Publishable Key" 
                    value={config.stripe_pk} 
                    fieldKey="stripe_pk" 
                    placeholder="pk_live_..." 
                />
                <KeyInput 
                    label="Secret Key" 
                    value={config.stripe_sk} 
                    fieldKey="stripe_sk" 
                    placeholder="sk_live_..." 
                />
            </IntegrationCard>
        </div>
    </div>
  );
}
