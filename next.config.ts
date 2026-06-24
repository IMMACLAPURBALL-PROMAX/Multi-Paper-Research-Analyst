import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tells Vercel's bundler NOT to strip the native binaries needed for the AI model
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
};

export default nextConfig;
