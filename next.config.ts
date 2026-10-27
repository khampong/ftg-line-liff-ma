import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["line-dev.forktechgroup.com", "*.forktechgroup.com"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;
