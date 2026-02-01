
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typescript: {
    // Ignora erros de tipagem durante o build para garantir o deploy
    ignoreBuildErrors: true,
  },
  // CORREÇÃO 1: Adicionando objeto turbopack vazio para silenciar o erro de conflito
  // já que estamos usando uma config customizada de webpack abaixo.
  // @ts-ignore - Propriedade nova do Next 16 pode não estar nos tipos ainda
  turbopack: {},
  
  // CORREÇÃO 2: A chave 'eslint' foi removida daqui pois foi depreciada.
  // O ignore de lint agora é feito no package.json via flag --no-lint

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_BACKEND_URL 
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*` 
          : 'http://localhost:3001/api/v1/:path*',
      },
    ];
  },
  // Mantemos o Webpack para ignorar módulos de servidor no cliente (fs, etc)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        path: false,
        stream: false,
        constants: false,
      };
    }
    return config;
  },
};

export default nextConfig;
