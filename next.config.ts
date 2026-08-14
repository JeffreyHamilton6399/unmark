import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Next 16 drops AGENTS.md / CLAUDE.md into the project root on build.
  // The other tools in this collection don't carry them.
  agentRules: false,
};

export default nextConfig;
