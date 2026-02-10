
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
import { GlobalErrorBoundary } from '@/components/system/GlobalErrorBoundary';
import { LoggerInitializer } from '@/components/system/LoggerInitializer';
import { MaintenanceGuard } from '@/components/system/MaintenanceGuard'; // NOVO
import { SystemBroadcast } from '@/components/layout/SystemBroadcast'; // NOVO

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Wancora CRM | Automação & IA",
  description: "Plataforma SaaS B2B Multi-Tenant",
  icons: {
    icon: 'https://image2url.com/r2/default/images/1770515092570-e1d6ccac-bf8b-4c45-8927-453176642fb5.png',
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
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} bg-background font-sans text-foreground`}>
        <GlobalErrorBoundary>
            <QueryProvider>
            <ToastProvider>
                <AuthProvider>
                <RealtimeProvider>
                    <MaintenanceGuard /> {/* NOVO: Bloqueio de Segurança */}
                    <VersionGuard />
                    <FocusGuard />
                    <LoggerInitializer />
                    <SystemBroadcast /> {/* NOVO: Avisos Globais */}
                    {children}
                    <GlobalSyncIndicator />
                    <DisconnectAlert />
                </RealtimeProvider>
                </AuthProvider>
            </ToastProvider>
            </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
