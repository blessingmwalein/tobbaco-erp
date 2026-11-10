import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source.
  transpilePackages: ["@tobacco/ui", "@tobacco/shared", "@tobacco/validation", "@tobacco/design-system"],
  typedRoutes: false,
  devIndicators: false,
  poweredByHeader: false,
};

export default nextConfig;
