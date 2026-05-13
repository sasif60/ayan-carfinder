import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.marketcheck.com" },
      { protocol: "https", hostname: "*.marketcheck.com" },
    ],
  },
};

export default nextConfig;
