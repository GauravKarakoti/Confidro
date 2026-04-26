import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  // Add this to resolve the workspace warning and potential hang
  serverExternalPackages: ['@cofhe/sdk']
};

export default nextConfig;