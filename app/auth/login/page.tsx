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

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      addToast({ type: 'success', title: "Sucesso", message: "Login realizado com sucesso!" });
      router.push("/dashboard");
      router.refresh();
      
    } catch (error: any) {
      addToast({ type: 'error', title: "Erro", message: error.message || "Credenciais inválidas." });
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
          <CardTitle className="text-2xl text-white text-center font-bold">Wancora CRM</CardTitle>
          <CardDescription className="text-center text-zinc-400">Entre para gerenciar seu atendimento</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase">Email</label>
              <Input 
                type="email" 
                placeholder="seu@email.com" 
                className="bg-zinc-950 border-zinc-800 text-white focus:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase">Senha</label>
              <Input 
                type="password" 
                className="bg-zinc-950 border-zinc-800 text-white focus:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Entrar"}
            </Button>

            <div className="text-center text-sm text-zinc-500 mt-4">
              Não tem conta? <Link href="/auth/register" className="text-primary hover:underline font-medium">Crie agora</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}