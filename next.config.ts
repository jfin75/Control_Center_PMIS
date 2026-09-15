import type { NextConfig } from "next";

/**
 * Fully static build. The same `out/` directory is served by Vercel and
 * embedded by Tauri (see src-tauri/tauri.conf.json → build.frontendDist),
 * so nothing here may depend on a Node server at runtime.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // The floating dev badge sits on top of the sidebar's collapse control.
  devIndicators: false,
};

export default nextConfig;
