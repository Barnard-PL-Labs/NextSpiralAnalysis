import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    runtime: "nodejs", // ✅ Ensures full Node.js server (not Edge Functions)
  },
  api: {
    responseLimit: false, // ✅ Prevents request size limits from blocking data
  },
};

export default nextConfig;
