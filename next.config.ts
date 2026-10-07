import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      fs: { browser: "./src/lib/empty.ts" },
      path: { browser: "./src/lib/empty.ts" },
    },
  },
  webpack: (cfg, { isServer }) => {
    if (!isServer) cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, path: false };
    return cfg;
  },
};

export default config;
