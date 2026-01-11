'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Zap, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name,
                company_id: crypto.randomUUID(), // In real app, create company record logic
                role: 'admin'
            }
        }
    });

    if (error) {
        alert(error.message);
        setLoading(false);
    } else {
        alert("Conta criada! Verifique seu email.");
        router.push('/auth/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

        <Card className="w-full max-w-md glass border-zinc-800 z-10">
            <CardHeader className="text-center">
                <div className="mx-auto bg-zinc-900 w-12 h-12 rounded-full flex items-center justify-center border border-zinc-700 mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold text-white">Criar Conta</CardTitle>
                <p className="text-sm text-zinc-400">Comece a automatizar seu WhatsApp hoje</p>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Nome da Empresa</label>
                        <Input 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="Ex: Wancora Tech"
                            className="bg-zinc-950 border-zinc-800 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Email</label>
                        <Input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-zinc-950 border-zinc-800 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Senha</label>
                        <Input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-zinc-950 border-zinc-800 text-white"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Criar Conta Grátis'}
                    </Button>
                </form>
                <div className="mt-4 text-center">
                    <Link href="/auth/login" className="text-xs text-zinc-500 hover:text-primary flex items-center justify-center gap-1">
                        <ArrowLeft className="w-3 h-3" /> Voltar para Login
                    </Link>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}