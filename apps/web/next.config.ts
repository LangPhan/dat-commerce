import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL || "http://localhost:8080";

const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  agentRules: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default config;
