
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
import { VersionGuard } from '@/components/system/VersionGuard';
import { FocusGuard } from '@/components/system/FocusGuard';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Wancora CRM | Automação & IA",
  description: "Plataforma SaaS B2B Multi-Tenant",
  icons: {
    // Nova logo ajustada (Versão Final)
    icon: 'https://image2url.com/r2/default/images/1770517454050-2f1ea8be-21f3-4ce1-8806-f0efa97ecc30.png',
  }
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
                <VersionGuard />
                <FocusGuard /> {/* Guardião de Foco Adicionado */}
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
