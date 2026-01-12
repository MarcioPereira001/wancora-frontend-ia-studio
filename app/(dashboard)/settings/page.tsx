'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Building, ShieldCheck, Mail, Users, CheckCircle, Save, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/hooks/useCompany';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';

export default function SettingsPage() {
  const { company } = useCompany();
  const { user, setUser } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('********************************');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
      if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSaveProfile = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
          const { error } = await supabase
            .from('profiles')
            .update({ name: name })
            .eq('id', user.id);

          if (error) throw error;
          
          // Atualiza store local
          setUser({ ...user, name });
          addToast({ type: 'success', title: 'Sucesso', message: 'Perfil atualizado.' });
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } finally {
          setLoading(false);
      }
  };

  const generateApiKey = () => {
      // Simulação de geração de chave (Num sistema real, isso viria do backend)
      const mockKey = `sk_live_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
      setApiKey(mockKey);
      setShowKey(true);
      addToast({ type: 'success', title: 'API Key Gerada', message: 'Use esta chave para integrar com sistemas externos.' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">Configurações da Conta</h1>
        <p className="text-zinc-400 text-sm">Gerencie os dados da sua organização e assinatura.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="md:col-span-2 space-y-6">
              
              {/* Card Organização */}
              <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Building className="w-32 h-32 text-zinc-100" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 relative z-10">
                      <Building className="w-5 h-5 text-primary" />
                      Dados da Organização
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
                      
                      {/* API Key Section */}
                      <div className="pt-4 border-t border-zinc-800 mt-4">
                          <label className="text-xs text-zinc-500 uppercase font-semibold flex justify-between items-center">
                              <span>Chave de API (Integração)</span>
                              <Button variant="link" size="sm" className="h-auto p-0 text-primary text-xs" onClick={generateApiKey}>Gerar Nova</Button>
                          </label>
                          <div className="flex gap-2 mt-1 relative">
                             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <Key className="h-4 w-4 text-zinc-500" />
                             </div>
                             <input 
                                type={showKey ? "text" : "password"} 
                                value={apiKey} 
                                readOnly
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-zinc-300 font-mono text-xs tracking-wider focus:ring-1 focus:ring-primary outline-none" 
                             />
                             <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowKey(!showKey)}
                                className="border-zinc-800 bg-zinc-900 min-w-[80px]"
                             >
                                {showKey ? "Ocultar" : "Mostrar"}
                             </Button>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">Use esta chave no Header <code>Authorization: Bearer SK_...</code> para acessar nossa API.</p>
                      </div>
                  </div>
              </div>

              {/* Card Perfil Editável */}
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
                      <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Email de Acesso</label>
                            <div className="flex items-center gap-2 mt-1 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                <Mail className="w-4 h-4 text-zinc-500" />
                                <span className="text-zinc-300 text-sm">{user?.email}</span>
                            </div>
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

          {/* Coluna Lateral (Assinatura) */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 flex flex-col h-fit sticky top-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Assinatura
              </h3>
              
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800 mb-6 text-center shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
                  <p className="text-zinc-400 text-sm mb-1 relative z-10">Seu plano atual</p>
                  <h4 className="text-3xl font-bold text-white mb-2 relative z-10">{company?.plan === 'starter' ? 'Starter' : company?.plan === 'pro' ? 'Pro' : 'Scale'}</h4>
                  <span className={`relative z-10 inline-block px-3 py-1 rounded-full text-xs font-bold border ${company?.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                      {company?.status === 'active' ? 'ATIVO' : 'TRIAL / INATIVO'}
                  </span>
              </div>

              <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-sm text-zinc-400 gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      {company?.plan === 'starter' ? '1 Conexão WhatsApp' : company?.plan === 'pro' ? '3 Conexões WhatsApp' : '10 Conexões WhatsApp'}
                  </li>
                  <li className="flex items-center text-sm text-zinc-400 gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      {company?.plan === 'starter' ? 'Sem Agentes IA' : 'Agentes IA Ilimitados'}
                  </li>
                  <li className="flex items-center text-sm text-zinc-400 gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      Suporte {company?.plan === 'scale' ? 'Dedicado' : 'por Email'}
                  </li>
              </ul>

              <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all hover:scale-[1.02]">
                  Gerenciar Cobrança
              </Button>
              <p className="text-center text-xs text-zinc-600 mt-3 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Processado via Stripe
              </p>
          </div>
      </div>
    </div>
  );
}