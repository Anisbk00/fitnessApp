import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Configure allowed dev origins for preview
  allowedDevOrigins: ['preview-chat-b4f6ef33-b99e-4b4c-855c-b3fa87ee6929.space.z.ai'],
  // Server external packages for Edge Runtime compatibility
  serverExternalPackages: ['@supabase/ssr'],
};

export default nextConfig;
