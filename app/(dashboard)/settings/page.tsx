'use client';

import React from 'react';
import { CreditCard, Building, ShieldCheck, Mail, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/hooks/useCompany';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsPage() {
  const { company } = useCompany();
  const { user } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">Configurações da Conta</h1>
        <p className="text-zinc-400 text-sm">Gerencie os dados da sua organização e assinatura.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card da Empresa */}
          <div className="md:col-span-2 space-y-6">
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
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-semibold">ID do Tenant (Supabase RLS)</label>
                          <div className="flex gap-2">
                             <input type="text" value={user?.company_id || '...'} disabled className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-500 mt-1 font-mono text-xs cursor-not-allowed" />
                             <Button variant="outline" size="icon" className="mt-1 border-zinc-800 bg-zinc-900"><ShieldCheck className="w-4 h-4 text-green-500" /></Button>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      Perfil do Usuário
                  </h3>
                  <div className="space-y-4">
                      <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Nome</label>
                            <input type="text" value={user?.name || ''} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 mt-1" />
                      </div>
                      <div>
                            <label className="text-xs text-zinc-500 uppercase font-semibold">Email de Acesso</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Mail className="w-4 h-4 text-zinc-500" />
                                <span className="text-zinc-300 text-sm">{user?.email}</span>
                            </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Card de Assinatura */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 flex flex-col h-fit">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Assinatura
              </h3>
              
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800 mb-6 text-center shadow-inner">
                  <p className="text-zinc-400 text-sm mb-1">Seu plano atual</p>
                  <h4 className="text-3xl font-bold text-white mb-2">{company?.plan === 'starter' ? 'Starter' : company?.plan === 'pro' ? 'Pro' : 'Scale'}</h4>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${company?.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
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

              <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                  Gerenciar Cobrança
              </Button>
              <p className="text-center text-xs text-zinc-600 mt-3">Processado via Stripe</p>
          </div>
      </div>
    </div>
  );
}