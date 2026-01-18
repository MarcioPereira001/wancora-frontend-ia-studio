
'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Copy, Shield, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';

export default function TeamSettingsPage() {
  const { user } = useAuthStore();
  const { members } = useTeam();
  const { addToast } = useToast();
  const supabase = createClient();
  const [copied, setCopied] = useState(false);

  // Link de convite baseado na URL atual + ref=company_id
  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/register?ref=${user?.company_id}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ type: 'success', title: 'Copiado', message: 'Link de convite copiado.' });
  };

  const handleRemoveMember = async (memberId: string) => {
      if(!confirm('Tem certeza? Este usuário perderá acesso à empresa.')) return;

      const { error } = await supabase
        .from('profiles')
        .update({ company_id: null }) // Remove vínculo (soft remove)
        .eq('id', memberId);

      if (error) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } else {
          addToast({ type: 'success', title: 'Removido', message: 'Membro removido da equipe.' });
          // O hook useTeam atualizará automaticamente pelo React Query se configurado, ou precisa de refresh manual
          window.location.reload(); 
      }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
      if(memberId === user?.id) return; // Não pode mudar o próprio papel aqui
      
      const newRole = currentRole === 'admin' ? 'agent' : 'admin';
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);

      if (error) {
          addToast({ type: 'error', title: 'Erro', message: error.message });
      } else {
          addToast({ type: 'success', title: 'Atualizado', message: `Papel alterado para ${newRole}.` });
          window.location.reload();
      }
  };

  if (user?.role !== 'owner' && user?.role !== 'admin') {
      return (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <Shield className="w-12 h-12 mb-4 text-zinc-700" />
              <h2 className="text-xl font-bold text-white">Acesso Restrito</h2>
              <p>Apenas administradores podem gerenciar a equipe.</p>
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Gestão de Equipe
          </h1>
          <p className="text-zinc-400 mt-1">Gerencie os membros e permissões da sua organização.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Invite Card */}
          <div className="md:col-span-1">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6 sticky top-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 border border-primary/20">
                      <UserPlus className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Convidar Membros</h3>
                  <p className="text-sm text-zinc-400 mb-6">
                      Compartilhe este link. Ao se cadastrarem, os usuários serão vinculados automaticamente à sua empresa.
                  </p>
                  
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Link de Convite</label>
                      <div className="flex gap-2">
                          <input 
                            value={inviteLink} 
                            readOnly 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono"
                          />
                          <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0 border-zinc-800 hover:bg-zinc-800">
                              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Members List */}
          <div className="md:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Membros ({members.length})</h3>
              
              {members.map(member => (
                  <div key={member.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-lg font-bold text-zinc-400 overflow-hidden">
                              {member.avatar_url ? (
                                  <img src={member.avatar_url} className="w-full h-full object-cover" />
                              ) : (member.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-white">{member.name || 'Sem Nome'}</h4>
                                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold", 
                                      member.role === 'owner' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                      member.role === 'admin' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                      "bg-zinc-800 text-zinc-400 border-zinc-700"
                                  )}>
                                      {member.role === 'owner' ? 'Proprietário' : member.role === 'admin' ? 'Admin' : 'Agente'}
                                  </span>
                              </div>
                              <p className="text-sm text-zinc-500">{member.email}</p>
                          </div>
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {member.role !== 'owner' && user?.id !== member.id && (
                              <>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-xs text-zinc-400 hover:text-white"
                                    onClick={() => handleToggleRole(member.id, member.role)}
                                >
                                    {member.role === 'admin' ? 'Rebaixar para Agente' : 'Promover a Admin'}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                    onClick={() => handleRemoveMember(member.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}
