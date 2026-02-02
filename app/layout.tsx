
import React from 'react';
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/providers/AuthProvider";
import QueryProvider from "@/providers/QueryProvider";
import RealtimeProvider from "@/providers/RealtimeProvider"; 
import { ToastProvider } from "@/context/ToastContext";
import { GlobalSyncIndicator } from '@/components/layout/GlobalSyncIndicator';
import { DisconnectAlert } from '@/components/modals/DisconnectAlert';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Wancora CRM | Automação & IA",
  description: "Plataforma SaaS B2B Multi-Tenant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
          {/* CDN FIX: Carrega estilos do editor Quill globalmente para evitar erros de build 'Module not found' */}
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} bg-background font-sans text-foreground`}>
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              {/* RealtimeProvider deve estar DENTRO do AuthProvider para acessar o user */}
              <RealtimeProvider>
                {children}
                {/* INDICADORES GLOBAIS (Acima de tudo) */}
                <GlobalSyncIndicator />
                <DisconnectAlert />
              </RealtimeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
