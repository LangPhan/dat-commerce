import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL || "http://localhost:8080";

const config: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  devIndicators: false,
  agentRules: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@tanstack/react-table",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${apiInternalUrl}/storage/:path*`,
      },
    ];
  },
};

export default config;
