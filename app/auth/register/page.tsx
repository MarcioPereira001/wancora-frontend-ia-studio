'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";
import { Loader2, CheckCircle2, Rocket, Building2, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Dados, 2: Planos
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
    termsAccepted: false
  });

  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'scale'>('starter');

  const plans = [
    {
      id: 'starter',
      name: 'Starter (Trial)',
      price: 'Grátis / 7 dias',
      features: ['1 Usuário', 'Conexão WhatsApp', 'CRM Básico', 'Suporte por Email'],
      trial: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'R$ 97 /mês',
      features: ['5 Usuários', 'Automações Simples', 'CRM Avançado', 'Suporte Prioritário'],
      trial: false
    },
    {
      id: 'scale',
      name: 'Scale',
      price: 'R$ 197 /mês',
      features: ['Ilimitado', 'IA Integrada', 'API Aberta', 'Gerente de Conta'],
      trial: false
    }
  ];

  const handleRegister = async () => {
    if (!formData.termsAccepted) {
      addToast({ type: 'warning', title: "Atenção", message: "Você precisa aceitar os Termos de Uso." });
      return;
    }

    setLoading(true);

    try {
      // 1. Cria Usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.name }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      // 2. Calcula data de trial
      let trialEndsAt = null;
      if (selectedPlan === 'starter') {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        trialEndsAt = date.toISOString();
      }

      // 3. Cria a Empresa
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .insert({
            name: formData.companyName,
            phone: formData.phone,
            status: 'active',
            plan: selectedPlan,
            trial_ends_at: trialEndsAt
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 4. Cria o Perfil Vinculado
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            company_id: companyData.id,
            role: 'owner',
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      addToast({ type: 'success', title: "Bem-vindo!", message: "Conta criada com sucesso!" });
      
      router.push("/auth/login");

    } catch (error: any) {
      console.error(error);
      addToast({ type: 'error', title: "Erro no registro", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center z-10">
        
        {/* Lado Esquerdo: Marketing */}
        <div className="hidden lg:block space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-sm font-medium">
            <Rocket size={16} />
            <span>Plataforma #1 de Vendas</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight">
            Destrave suas vendas com <span className="text-primary">Inteligência.</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Junte-se a mais de 500 empresas que automatizam atendimento e fecham mais negócios todos os dias.
          </p>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="text-green-500" /> <span>CRM Integrado ao WhatsApp</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="text-green-500" /> <span>Automação de Mensagens</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="text-green-500" /> <span>Gestão de Leads Kanban</span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Formulário */}
        <Card className="w-full bg-zinc-900/50 border-zinc-800 backdrop-blur-sm shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white font-bold">
              {step === 1 ? "Crie sua conta" : "Escolha seu plano"}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              {step === 1 ? "Preencha seus dados para começar." : "Selecione a melhor opção para seu negócio."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase">Nome Completo</label>
                    <Input 
                      placeholder="Seu nome" 
                      className="bg-zinc-950 border-zinc-800 text-white"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase">Celular / WhatsApp</label>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      className="bg-zinc-950 border-zinc-800 text-white"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase">Nome da Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input 
                      placeholder="Ex: Wancora Tecnologia" 
                      className="pl-9 bg-zinc-950 border-zinc-800 text-white"
                      value={formData.companyName}
                      onChange={e => setFormData({...formData, companyName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase">Email Corporativo</label>
                  <Input 
                    type="email" 
                    placeholder="seu@empresa.com" 
                    className="bg-zinc-950 border-zinc-800 text-white"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase">Senha</label>
                  <Input 
                    type="password" 
                    placeholder="Mínimo 6 caracteres"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>

                <Button 
                  className="w-full bg-white text-zinc-950 hover:bg-zinc-200 mt-4 font-bold"
                  onClick={() => {
                    if(formData.name && formData.email && formData.password && formData.companyName) {
                      setStep(2);
                    } else {
                      addToast({ type: 'warning', title: "Atenção", message: "Preencha todos os campos obrigatórios." });
                    }
                  }}
                >
                  Continuar para Planos
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid gap-4">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id as any)}
                      className={`
                        relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${selectedPlan === plan.id 
                          ? 'border-green-500 bg-green-500/5' 
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}
                      `}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-white">{plan.name}</h3>
                        <span className={`text-sm font-mono ${plan.trial ? 'text-green-400' : 'text-zinc-300'}`}>
                          {plan.price}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 flex gap-2 flex-wrap">
                        {plan.features.slice(0, 3).map((f, i) => (
                          <span key={i} className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{f}</span>
                        ))}
                      </div>
                      {selectedPlan === plan.id && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                          SELECIONADO
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox 
                    id="terms" 
                    checked={formData.termsAccepted}
                    onCheckedChange={(c: boolean) => setFormData({...formData, termsAccepted: c})}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none text-zinc-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Aceito os Termos de Uso e Política de Privacidade.
                    </label>
                    <p className="text-xs text-zinc-500">
                      Ao continuar, você concorda que leu e aceitou nossos termos legais.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                    Voltar
                  </Button>
                  <Button 
                    className="w-2/3 bg-primary hover:bg-primary/90 text-white font-bold"
                    onClick={handleRegister}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                    {selectedPlan === 'starter' ? 'Iniciar Teste Grátis' : 'Ir para Pagamento'}
                  </Button>
                </div>
              </div>
            )}

            <div className="text-center text-sm text-zinc-500 mt-6">
              Já tem conta? <Link href="/auth/login" className="text-primary hover:underline">Faça login</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}