import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // A configuração 'eslint' foi removida pois não é mais suportada neste formato no Next.js 15+
  // Server Actions agora são estáveis e não precisam de flag experimental
};

export default nextConfig;