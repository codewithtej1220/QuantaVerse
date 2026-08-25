import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the parent directory
  // otherwise makes Turbopack guess wrong and warn on every start.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
