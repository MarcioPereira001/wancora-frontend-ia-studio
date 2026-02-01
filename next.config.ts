
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
      };
    }
    return config;
  },
};

export default nextConfig;
