import React from 'react';
import LandingPage from './app/page';
import './app/globals.css';

// COMPATIBILITY LAYER:
// Este arquivo conecta o ponto de entrada legado (index.tsx) à nova estrutura (app/page.tsx).
// Isso permite visualizar a Landing Page em ambientes de preview que não executam o servidor Next.js completo.

export default function PreviewEntry() {
  return (
    <div className="antialiased text-zinc-50 bg-zinc-950 min-h-screen font-sans">
      <LandingPage />
    </div>
  );
}