
'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Building, ShieldCheck, Mail, Users, CheckCircle, Save, Loader2, Key, Bot, HardDrive, Clock, AlertTriangle, Gift, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/hooks/useCompany';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';

export default function SettingsPage() {
  const { company } = useCompany();
  const { user, setUser } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  
  // AI Config
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Retention Config
  const [retentionDays, setRetentionDays] = useState(30);
  const [hasDrive, setHasDrive] = useState(false);
  
  // Referral
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
      if (user?.name) setName(user.name);
      
      // Fetch referral code
      if (user?.id) {
          supabase.from('profiles').select('referral_code').eq('id', user.id).single()
          .then(({data}) => {
              if(data?.referral_code) setReferralCode(data.referral_code);
          });
      }
  }, [user?.name, user?.id]);

  // Carregar Configurações e Check Drive
  useEffect(() => {
      if (company?.id) {
          const fetchConfig = async () => {
              // 1. Configs da Empresa
              const { data } = await supabase.from('companies').select('ai_config, storage_retention_days').eq('id', company.id).single();
              if (data?.ai_config?.apiKey) setGeminiKey(data.ai_config.apiKey);
              if (data?.storage_retention_days) setRetentionDays(data.storage_retention_days);

              // 2. Check Drive Conectado
              // FIX: Seleciona 'company_id' em vez de 'id', pois a tabela integrations_google usa company_id como PK
              const { data: driveData } = await supabase.from('integrations_google').select('company_id').eq('company_id', company.id).maybeSingle();
              setHasDrive(!!driveData);
          };
          fetchConfig();
      }
  }, [company?.id]);

  const handleSaveProfile = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
          const { error } = await supabase
            .from('profiles')
            .update({ name: name })
            .eq('id', user.id);

          if (error) throw error;
          setUser({ ...user, name });
          addToast({ type: 'success', title: 'Sucesso', message: 'Perfil atualizado.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const handleSaveConfig = async () => {
      if (!company?.id) return;
      setLoading(true);
      try {
          const newAiConfig = {
              provider: 'gemini',
              apiKey: geminiKey,
              model: 'gemini-1.5-flash', // ATUALIZADO: Modelo Estável de Produção
              updatedAt: new Date().toISOString()
          };

          const { error } = await supabase
              .from('companies')
              .update({ 
                  ai_config: newAiConfig,
                  storage_retention_days: retentionDays
              })
              .eq('id', company.id);

          if (error) throw error;
          addToast({ type: 'success', title: 'Salvo', message: 'Configurações da empresa atualizadas.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const startDriveAuth = async () => {
      try {
          const res = await api.post('/cloud/google/connect', { companyId: company?.id });
          if (res.url) window.location.href = res.url;
      } catch (e) { addToast({type: 'error', title: 'Erro', message: 'Falha ao iniciar conexão.'}); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Configurações da Conta</h1>
        <p className="text-zinc-400 text-sm">Gerencie os dados da sua organização, IA e retenção de dados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="md:col-span-2 space-y-6">
              
              {/* Card Organização & Retenção */}
              <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                      <HardDrive className="w-32 h-32 text-zinc-100" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 relative z-10">
                      <Building className="w-5 h-5 text-primary" />
                      Dados e Armazenamento
                  </h3>
                  
                  <div className="space-y-4 relative z-10">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Nome da Empresa</label>
                            <input type="text" value={company?.name || 'Carregando...'} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 mt-1 cursor-not-allowed opacity-70" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Plano Ativo</label>
                            <input type="text" value={company?.plan?.toUpperCase() || '...'} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-primary font-bold mt-1 cursor-not-allowed opacity-70 border-primary/20" />
                        </div>
                      </div>

                      <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 mt-2">
                          <label className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-blue-500" /> Retenção de Mídia (Dias)
                          </label>
                          <div className="flex gap-2">
                              {[30, 60, 90].map(days => (
                                  <button
                                      key={days}
                                      onClick={() => setRetentionDays(days)}
                                      className={`flex-1 py-2 rounded-md text-sm font-medium border transition-all ${
                                          retentionDays === days 
                                          ? 'bg-blue-600 border-blue-500 text-white' 
                                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                      }`}
                                  >
                                      {days} Dias
                                  </button>
                              ))}
                          </div>

                          {!hasDrive ? (
                              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded flex gap-3 items-start">
                                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                  <div>
                                      <p className="text-xs text-red-200 font-bold">Google Drive Desconectado!</p>
                                      <p className="text-[10px] text-red-300/70 mt-1">
                                          Arquivos mais antigos que {retentionDays} dias serão <strong>APAGADOS PERMANENTEMENTE</strong> para liberar espaço. 
                                          <button onClick={startDriveAuth} className="underline ml-1 hover:text-white">Conecte o Drive agora</button> para salvar backup automático na lixeira.
                                      </p>
                                  </div>
                              </div>
                          ) : (
                              <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Backup no Google Drive ativo (Pasta Lixeira Wancora).
                              </p>
                          )}
                      </div>
                  </div>
              </div>

              {/* Card IA */}
              <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Bot className="w-32 h-32 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 relative z-10">
                      <Bot className="w-5 h-5 text-emerald-500" />
                      Motor de Inteligência (IA)
                  </h3>
                  
                  <div className="space-y-4 relative z-10">
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-semibold">API Key (Google AI Studio)</label>
                          <div className="flex gap-2 relative mt-2">
                             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <Key className="h-4 w-4 text-zinc-500" />
                             </div>
                             <input 
                                type={showGeminiKey ? "text" : "password"} 
                                value={geminiKey} 
                                onChange={(e) => setGeminiKey(e.target.value)}
                                placeholder="Cole sua API Key aqui (AIzaSy...)"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-zinc-300 font-mono text-xs tracking-wider focus:ring-1 focus:ring-emerald-500 outline-none" 
                             />
                             <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowGeminiKey(!showGeminiKey)}
                                className="border-zinc-800 bg-zinc-900 min-w-[80px]"
                             >
                                {showGeminiKey ? "Ocultar" : "Mostrar"}
                             </Button>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-2">
                              A chave configurada será utilizada para todos os agentes da empresa usando o modelo <strong>Gemini 1.5 Flash</strong>.
                              <br/><span className="text-yellow-500">Nota:</span> Certifique-se de que o projeto no Google Cloud tem faturamento ativado para evitar erros 404/403.
                          </p>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-white/5 mt-4">
                          <Button onClick={handleSaveConfig} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                              Salvar Configurações
                          </Button>
                      </div>
                  </div>
              </div>

              {/* Card Perfil */}
              <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      Perfil do Usuário
                  </h3>
                  <div className="space-y-4">
                      <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Nome Completo</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white mt-1 focus:ring-1 focus:ring-primary outline-none transition-all" 
                            />
                      </div>
                      <div className="flex justify-end pt-2">
                          <Button onClick={handleSaveProfile} disabled={loading} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                              Salvar Alterações
                          </Button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Coluna Lateral (Assinatura & Referral) */}
          <div className="flex flex-col gap-6 sticky top-6 h-fit">
              {/* ASSINATURA */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-500" />
                      Assinatura
                  </h3>
                  
                  <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800 text-center shadow-inner relative overflow-hidden group">
                      <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
                      <p className="text-zinc-400 text-sm mb-1 relative z-10">Seu plano atual</p>
                      <h4 className="text-3xl font-bold text-white mb-2 relative z-10">{company?.plan === 'starter' ? 'Starter' : company?.plan === 'pro' ? 'Pro' : 'Scale'}</h4>
                      <span className={`relative z-10 inline-block px-3 py-1 rounded-full text-xs font-bold border ${company?.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                          {company?.status === 'active' ? 'ATIVO' : 'TRIAL / INATIVO'}
                      </span>
                  </div>
              </div>

              {/* INDICAÇÃO */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-yellow-500/20 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                      <Gift className="w-16 h-16 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-yellow-500" />
                      Indique e Ganhe
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                      Ganhe 1 mês grátis do plano Pro para cada empresa que se cadastrar com seu link.
                  </p>
                  <div className="bg-black/50 border border-zinc-800 rounded-lg p-2 flex items-center gap-2 relative z-10">
                      <code className="flex-1 text-xs font-mono text-zinc-300 truncate">
                          {`wancora-crm.app/auth/register?ref=${referralCode || '...'}`}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={() => { 
                            navigator.clipboard.writeText(`https://wancora-crm.app/auth/register?ref=${referralCode}`);
                            addToast({ type: 'success', title: 'Copiado', message: 'Link de indicação copiado.' });
                        }}
                      >
                          <Copy className="w-4 h-4" />
                      </Button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
