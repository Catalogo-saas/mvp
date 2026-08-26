import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost"
      },
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  allowedDevOrigins:["mendy-certificatory-nonsequaciously.ngrok-free.dev"]
};

export default nextConfig;
