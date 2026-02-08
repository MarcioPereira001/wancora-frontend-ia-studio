
'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Verificação preliminar de Super Admin (A verificação real acontece no layout server-side)
      if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('super_admin').eq('id', data.user.id).single();
          
          if (!profile?.super_admin) {
              await supabase.auth.signOut();
              throw new Error("Acesso negado: Você não é um Super Administrador.");
          }
      }

      addToast({ type: 'success', title: "Acesso Concedido", message: "Bem-vindo à Matrix, Admin." });
      router.push("/admin/dashboard");
      router.refresh();
      
    } catch (error: any) {
      addToast({ type: 'error', title: "Acesso Negado", message: error.message || "Credenciais inválidas." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050000] p-4 relative overflow-hidden">
      {/* Background Effects (Red Theme) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-900 to-transparent opacity-50"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-900/5 rounded-full blur-3xl"></div>

      <Card className="w-full max-w-md bg-zinc-950/80 border-red-900/30 backdrop-blur-md z-10 shadow-[0_0_50px_rgba(153,27,27,0.1)]">
        <CardHeader>
            <div className="mx-auto bg-red-950/30 p-3 rounded-full border border-red-900/50 mb-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
          <CardTitle className="text-2xl text-white text-center font-bold tracking-widest uppercase">Acesso Restrito</CardTitle>
          <CardDescription className="text-center text-red-400/60 font-mono text-xs">
            Área de Super Administração do Sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ID de Comando</label>
              <Input 
                type="email" 
                placeholder="admin@wancora.com" 
                className="bg-black/50 border-zinc-800 text-white focus:ring-red-900 focus:border-red-900 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Chave de Acesso</label>
              <Input 
                type="password" 
                className="bg-black/50 border-zinc-800 text-white focus:ring-red-900 focus:border-red-900 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full bg-red-900 hover:bg-red-800 text-white font-bold tracking-wider shadow-[0_0_20px_rgba(153,27,27,0.4)]" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "AUTENTICAR"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
