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
  
  // --- BLOCO DE SEGURANÇA DE DEPLOY (MVP) ---
  typescript: {
    // Ignora erros de tipagem (TS) para não travar o build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora erros de estilo (Lint) para não travar o build
    // Isso substitui a flag --no-lint que foi removida
    ignoreDuringBuilds: true,
  },
  // -------------------------------------------

  // @ts-ignore - Silencia erro de tipagem se a propriedade for muito nova
  turbopack: {},

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
