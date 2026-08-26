import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // Vercel routes /api/* directly to api/index.py. Keep this proxy only for
    // `bun dev`, where the FastAPI server runs separately on port 5328.
    if (process.env.VERCEL) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5328/api/:path*',
      },
    ];
  },
  // CrewAI turns often take 20–40s; Next's default rewrite proxy timeout is 30s
  // and surfaces as "socket hang up" / Internal Server Error.
  experimental: {
    proxyTimeout: 120_000,
  },
  reactCompiler: true,
};

export default nextConfig;
