import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

const nextConfig: NextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  serverExternalPackages: ["postgres", "ioredis"],
  // Permitir túneles de ngrok y orígenes locales en desarrollo
  allowedDevOrigins: [
    "localhost:3002",
    "127.0.0.1:3002",
    "localhost:3000",
    "127.0.0.1:3000",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3002",
        "127.0.0.1:3002",
        "*.ngrok-free.app",
        "*.ngrok-free.dev",
        "*.ngrok.io",
        "*.ngrok.app",
      ],
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        source: "/ort/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
