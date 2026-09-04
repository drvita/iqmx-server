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
    "localhost:3001",
    "127.0.0.1:3001",
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
  async redirects() {
    return [
      {
        source: "/landingpage/whatsapp",
        destination: "/landingpage/crm",
        permanent: true,
      },
      {
        source: "/landingpage/consultorios",
        destination: "/landingpage/crm/consultorio",
        permanent: true,
      },
      {
        source: "/landingpage/consultorio",
        destination: "/landingpage/crm/consultorio",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
