'use client';

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";
import { Loader2, Building } from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Lógica de Convite
  const inviteCompanyId = searchParams.get('ref');
  const [invitingCompany, setInvitingCompany] = useState<{name: string} | null>(null);

  useEffect(() => {
      if(inviteCompanyId) {
          const fetchCompany = async () => {
              const { data } = await supabase.from('companies').select('name').eq('id', inviteCompanyId).single();
              if(data) setInvitingCompany(data);
          };
          fetchCompany();
      }
  }, [inviteCompanyId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      let targetCompanyId = inviteCompanyId;

      // 2. Create Company (APENAS SE NÃO FOR CONVITE)
      if (!targetCompanyId) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .insert({
                name: companyName,
                plan: 'starter',
                status: 'active'
            })
            .select()
            .single();
            
          if (companyError) throw companyError;
          targetCompanyId = companyData.id;

           // Criar Pipeline Default
           try {
              const { data: pipeline } = await supabase
                .from("pipelines")
                .insert({ company_id: companyData.id, name: 'Funil de Vendas', is_default: true })
                .select()
                .single();

              if (pipeline) {
                  const stages = [
                      { pipeline_id: pipeline.id, name: 'Novos', position: 0, color: '#3b82f6', company_id: companyData.id },
                      { pipeline_id: pipeline.id, name: 'Qualificação', position: 1, color: '#eab308', company_id: companyData.id },
                      { pipeline_id: pipeline.id, name: 'Negociação', position: 2, color: '#f97316', company_id: companyData.id },
                      { pipeline_id: pipeline.id, name: 'Ganho', position: 3, color: '#22c55e', company_id: companyData.id }
                  ];
                  await supabase.from("pipeline_stages").insert(stages);
              }
          } catch (crmError) {
              console.error("Erro não-bloqueante ao criar CRM:", crmError);
          }
      }

      // 3. Create Profile (Vincula à empresa alvo)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            name: name,
            company_id: targetCompanyId,
            role: inviteCompanyId ? 'agent' : 'owner' // Se for convite, entra como Agente. Se criou, é Owner.
        });

      if (profileError) throw profileError;

      addToast({ type: 'success', title: "Bem-vindo!", message: "Conta criada com sucesso!" });
      router.push("/auth/login");

    } catch (error: any) {
      addToast({ type: 'error', title: "Erro", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-md z-10">
        <CardHeader>
          <CardTitle className="text-2xl text-white text-center font-bold">Criar Conta</CardTitle>
          {invitingCompany ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center mt-2">
                  <p className="text-xs text-primary font-bold uppercase mb-1">Convite para entrar em</p>
                  <div className="flex items-center justify-center gap-2 text-white font-bold">
                      <Building className="w-4 h-4" /> {invitingCompany.name}
                  </div>
              </div>
          ) : (
            <CardDescription className="text-center text-zinc-400">Comece a usar o Wancora CRM hoje</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase">Nome Completo</label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            {!invitingCompany && (
                <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase">Nome da Empresa</label>
                <Input 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Sua empresa"
                    required
                    className="bg-zinc-950 border-zinc-800 text-white"
                />
                </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase">Email</label>
              <Input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" 
                required
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase">Senha</label>
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                required
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (invitingCompany ? "Aceitar Convite" : "Criar Conta")}
            </Button>

            <div className="text-center text-sm text-zinc-500 mt-4">
              Já tem conta? <Link href="/auth/login" className="text-primary hover:underline font-medium">Entrar</Link>
            </div>
          </form>
        </CardContent>
      </Card>
  );
}

// Wrapper Principal com Suspense
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

      <Suspense fallback={
        <div className="w-full max-w-md h-[500px] flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-xl backdrop-blur-md z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
}