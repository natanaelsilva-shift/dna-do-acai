import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.104",
    "192.168.0.108",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
