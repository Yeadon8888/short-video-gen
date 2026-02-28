import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large base64 video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
