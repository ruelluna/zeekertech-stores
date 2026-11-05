import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // @wfh/shared ships TypeScript source, not a build.
  transpilePackages: ["@wfh/shared"],
  // Stores live at /s/<slug>. Links and QR codes from before stores existed go to Weekend Food Hub
  // (temporary redirects, so "/" can become a store list later).
  async redirects() {
    return ["", "/checkout", "/account", "/login"].map((path) => ({
      source: path || "/",
      destination: `/s/weekendfoodhub${path}`,
      permanent: false,
    }));
  },
  experimental: {
    // GCash screenshots (max 5 MB) and admin photo uploads go through Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
