'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

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

      // 2. Create Company
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

      // 3. Create Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            name: name,
            company_id: companyData.id,
            role: 'owner'
        });

      if (profileError) throw profileError;

      // 4. Create Pipeline (Default)
      try {
          const { data: pipeline, error: pipeError } = await supabase
            .from("pipelines")
            .insert({
                company_id: companyData.id,
                name: 'Funil de Vendas',
                is_default: true
            })
            .select()
            .single();

          if (!pipeError && pipeline) {
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

      addToast({ type: 'success', title: "Bem-vindo!", message: "Conta criada com sucesso!" });
      router.push("/auth/login");

    } catch (error: any) {
      addToast({ type: 'error', title: "Erro", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

      <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-md z-10">
        <CardHeader>
          <CardTitle className="text-2xl text-white text-center font-bold">Criar Conta</CardTitle>
          <CardDescription className="text-center text-zinc-400">Comece a usar o Wancora CRM hoje</CardDescription>
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
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Criar Conta"}
            </Button>

            <div className="text-center text-sm text-zinc-500 mt-4">
              Já tem conta? <Link href="/auth/login" className="text-primary hover:underline font-medium">Entrar</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}