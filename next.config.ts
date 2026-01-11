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
  eslint: {
    // Ignore ESLint errors during build to prevent failures
    ignoreDuringBuilds: true,
  },
  // Next.js 15+ Server Actions are stable by default
  // No need for experimental flag unless configuring specific limits
};

export default nextConfig;