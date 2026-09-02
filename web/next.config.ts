import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@heroicons/react"],
  },
  // Permitir túneles de ngrok y orígenes locales en desarrollo
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  async rewrites() {
    const apiTarget = process.env.API_URL || "http://api:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
