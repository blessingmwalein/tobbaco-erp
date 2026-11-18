import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next allows ONE dev server per build directory. Set NEXT_DIST_DIR (e.g. ".next-e2e") to run a second, isolated instance —
  // for example the browser tests, which must talk to a disposable API/database rather than the one your dev server uses.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source.
  transpilePackages: ["@tobacco/ui", "@tobacco/shared", "@tobacco/validation", "@tobacco/design-system"],
  typedRoutes: false,
  devIndicators: false,
  poweredByHeader: false,
};

export default nextConfig;
