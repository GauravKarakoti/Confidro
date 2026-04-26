import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This helps Next.js ignore the root-level configuration if it's interfering
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;