
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Zap, CheckCircle, ArrowRight, Bot, LayoutDashboard, 
  MessageSquare, BarChart3, Globe, Cpu 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- COMPONENTS SECTIONS ---

const Navbar = () => (
  <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <img 
            src="https://image2url.com/r2/default/images/1770517454050-2f1ea8be-21f3-4ce1-8806-f0efa97ecc30.png" 
            alt="Wancora" 
            className="h-10 w-auto object-contain"
        />
      </Link>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
        <Link href="#features" className="hover:text-white transition-colors">Funcionalidades</Link>
        <Link href="#benefits" className="hover:text-white transition-colors">Vantagens</Link>
        <Link href="#pricing" className="hover:text-white transition-colors">Planos</Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/auth/login">
          <Button variant="ghost" className="text-zinc-300 hover:text-white">Entrar</Button>
        </Link>
        <Link href="/auth/register">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
            Começar Agora
          </Button>
        </Link>
      </div>
    </div>
  </nav>
);

const Hero = () => (
  <section className="relative pt-32 pb-20 overflow-hidden min-h-screen flex items-center">
    {/* Background Grid */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    
    {/* Glow Effects */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-30 pointer-events-none"></div>

    <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Nova Versão 2.0 Disponível
        </span>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 leading-tight">
          Venda mais pelo <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-400 to-emerald-600">
            WhatsApp com IA
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Centralize atendimentos, organize leads em um CRM Kanban e deixe nossos 
          Agentes de IA venderem por você 24/7. A plataforma definitiva para escalar sua operação.
        </p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <Link href="/auth/register" className="w-full md:w-auto">
            <Button size="lg" className="w-full md:w-auto h-14 text-lg px-8 bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              Criar Conta Grátis <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="#demo" className="w-full md:w-auto">
            <Button size="lg" variant="outline" className="w-full md:w-auto h-14 text-lg px-8 border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800">
              Ver Demonstração
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Hero Image Mockup */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-20 relative mx-auto max-w-5xl rounded-xl border border-white/10 shadow-2xl bg-zinc-900/50 backdrop-blur-sm overflow-hidden"
      >
        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        <div className="p-4 flex items-center gap-2 border-b border-white/5 bg-zinc-950/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
          <div className="text-xs text-zinc-500 font-mono ml-4">wancora-crm.app</div>
        </div>
        <div className="aspect-[16/9] bg-zinc-950 relative flex items-center justify-center text-zinc-800">
             {/* Abstract UI Representation */}
             <div className="absolute inset-0 flex">
                <div className="w-64 border-r border-white/5 bg-zinc-900/30 p-4 space-y-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-12 w-full bg-white/5 rounded-lg animate-pulse" style={{animationDelay: `${i*100}ms`}}></div>)}
                </div>
                <div className="flex-1 p-6 space-y-4">
                    <div className="flex gap-4 mb-8">
                        {[1,2,3].map(i => <div key={i} className="h-32 flex-1 bg-white/5 rounded-xl border border-white/5"></div>)}
                    </div>
                    <div className="h-64 w-full bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                        <span className="text-zinc-700 font-mono text-sm">Dashboard Analytics UI</span>
                    </div>
                </div>
             </div>
        </div>
      </motion.div>
    </div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, description }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-primary/30 transition-all hover:shadow-[0_0_30px_-10px_rgba(34,197,94,0.15)]"
  >
    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-primary">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-zinc-400 leading-relaxed text-sm">{description}</p>
  </motion.div>
);

const Features = () => (
  <section id="features" className="py-24 bg-zinc-950 relative">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Tudo o que você precisa em um só lugar</h2>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Substitua 5 ferramentas diferentes pelo Wancora CRM e economize enquanto escala.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <FeatureCard 
          icon={MessageSquare}
          title="Automação de WhatsApp"
          description="Conecte seu número oficial, crie fluxos de conversa e responda leads instantaneamente sem depender de humanos."
        />
        <FeatureCard 
          icon={Bot}
          title="Agentes de IA (Gemini)"
          description="Nossos agentes inteligentes aprendem sobre sua empresa e negociam, agendam e tiram dúvidas como um expert."
        />
        <FeatureCard 
          icon={LayoutDashboard}
          title="CRM Kanban Nativo"
          description="Organize seus leads visualmente. Arraste cards, agende follow-ups e nunca mais perca uma venda por esquecimento."
        />
        <FeatureCard 
          icon={BarChart3}
          title="Métricas em Tempo Real"
          description="Dashboard completo para acompanhar conversão, tempo de resposta e ROI das suas campanhas."
        />
        <FeatureCard 
          icon={Globe}
          title="Multi-Tenant & Seguro"
          description="Arquitetura robusta para suportar múltiplas empresas e usuários com isolamento total de dados."
        />
        <FeatureCard 
          icon={Cpu}
          title="Integração via API"
          description="Conecte o Wancora com seu site, Facebook Ads ou sistemas legados através de nossa API REST simples."
        />
      </div>
    </div>
  </section>
);

const ObjectionHandling = () => (
  <section id="benefits" className="py-24 relative overflow-hidden">
     <div className="absolute inset-0 bg-primary/5 clip-path-polygon"></div>
     <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Por que continuar perdendo vendas no "X1"?
            </h2>
            <div className="space-y-6">
                {[
                    "Chega de perder leads porque demorou para responder.",
                    "Fim da bagunça de conversas misturadas no WhatsApp pessoal.",
                    "Não dependa apenas do humor dos seus vendedores.",
                    "Tenha controle total sobre o que é falado com seus clientes."
                ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                        <div className="mt-1 min-w-[20px]">
                            <CheckCircle className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-zinc-300 text-lg">{item}</p>
                    </div>
                ))}
            </div>
            <div className="mt-10">
                <Link href="/auth/register">
                    <Button size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                        Quero Organizar Minha Empresa
                    </Button>
                </Link>
            </div>
        </div>
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur-2xl opacity-20"></div>
            <div className="relative bg-zinc-900 border border-white/10 p-8 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold">Wancora IA</h4>
                        <p className="text-xs text-zinc-500">Agente de Vendas</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-zinc-800/50 p-3 rounded-lg rounded-tl-none border border-white/5 text-sm text-zinc-300 max-w-[80%]">
                        Olá! Vi que você tem interesse no plano Pro. Posso te explicar como ele aumenta suas vendas em 30%?
                    </div>
                    <div className="bg-primary/20 p-3 rounded-lg rounded-tr-none border border-primary/20 text-sm text-white ml-auto max-w-[80%]">
                        Nossa, sério? Como funciona a parte de automação?
                    </div>
                    <div className="bg-zinc-800/50 p-3 rounded-lg rounded-tl-none border border-white/5 text-sm text-zinc-300 max-w-[80%]">
                        É simples! Você configura o fluxo uma vez e eu atendo todos os clientes instantaneamente, qualificando e agendando reuniões para você. 🚀
                    </div>
                </div>
            </div>
        </div>
     </div>
  </section>
);

const PricingCard = ({ title, price, features, isPro = false }: any) => (
  <div className={`relative p-8 rounded-2xl border ${isPro ? 'border-primary bg-zinc-900/80 shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]' : 'border-zinc-800 bg-zinc-900/30'} flex flex-col`}>
    {isPro && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
        Mais Popular
      </div>
    )}
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <div className="flex items-baseline gap-1 mb-6">
      <span className="text-3xl font-bold text-white">R$ {price}</span>
      <span className="text-zinc-500">/mês</span>
    </div>
    <ul className="space-y-4 mb-8 flex-1">
      {features.map((feat: string, i: number) => (
        <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
          <CheckCircle className={`w-4 h-4 ${isPro ? 'text-primary' : 'text-zinc-500'}`} />
          {feat}
        </li>
      ))}
    </ul>
    <Link href="/auth/register" className="w-full">
      <Button className={`w-full ${isPro ? 'bg-primary hover:bg-primary/90' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
        Escolher Plano
      </Button>
    </Link>
  </div>
);

const Pricing = () => (
  <section id="pricing" className="py-24 bg-zinc-950">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Investimento Simples e Transparente</h2>
        <p className="text-zinc-400">Sem taxas escondidas. Cancele quando quiser.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <PricingCard 
          title="Start"
          price="97"
          features={[
            "1 Conexão de WhatsApp",
            "CRM Kanban Básico",
            "Até 500 leads/mês",
            "Suporte por Email"
          ]}
        />
        <PricingCard 
          title="Pro"
          price="197"
          isPro={true}
          features={[
            "3 Conexões de WhatsApp",
            "Agentes de IA (Gemini)",
            "Disparos em Massa",
            "Leads Ilimitados",
            "Suporte Prioritário"
          ]}
        />
        <PricingCard 
          title="Enterprise"
          price="497"
          features={[
            "10 Conexões de WhatsApp",
            "API White-label",
            "Consultoria de Implantação",
            "Gestor de Conta Dedicado",
            "SLA Garantido"
          ]}
        />
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-12 border-t border-white/5 bg-zinc-950">
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2">
        <img 
            src="https://image2url.com/r2/default/images/1770517454050-2f1ea8be-21f3-4ce1-8806-f0efa97ecc30.png" 
            alt="Wancora" 
            className="h-8 w-auto object-contain grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all"
        />
      </div>
      <div className="text-zinc-500 text-sm">
        &copy; 2026 Wancora Tech. Todos os direitos reservados.
      </div>
      <div className="flex gap-6">
        <a href="#" className="text-zinc-500 hover:text-white transition-colors">Termos</a>
        <a href="#" className="text-zinc-500 hover:text-white transition-colors">Privacidade</a>
        <a href="#" className="text-zinc-500 hover:text-white transition-colors">Suporte</a>
      </div>
    </div>
  </footer>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-primary/30">
      <Navbar />
      <Hero />
      <Features />
      <ObjectionHandling />
      <Pricing />
      <section className="py-24 bg-gradient-to-b from-zinc-900 to-zinc-950 text-center px-6">
        <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Pronto para revolucionar seu comercial?</h2>
            <p className="text-zinc-400 mb-8">
                Junte-se a mais de 1.000 empresas que usam o Wancora para vender todos os dias no piloto automático.
            </p>
            <Link href="/auth/register">
                <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-pulse">
                    Começar Teste Grátis
                </Button>
            </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}
