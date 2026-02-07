
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
    ignoreBuildErrors: true,
  },
  // Proxy para o Backend
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
  // FIX 404 CHUNKS: Força o navegador a revalidar arquivos HTML/JSON cruciais
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Configuração do Webpack para ignorar 'fs' e outros módulos nativos no client-side
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
        os: false,
        crypto: false,
        encoding: false, // FIX CRÍTICO: Resolve o erro "Can't resolve 'encoding'"
      };
    }
    return config;
  },
};

export default nextConfig;
