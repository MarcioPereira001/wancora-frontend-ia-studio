import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Desativa para evitar chamadas duplas em dev que causam loops
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Proxy para o Backend evitar CORS/403
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
};

export default nextConfig;