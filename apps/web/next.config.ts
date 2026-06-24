import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@renovi/core", "@renovi/db"],
};

export default nextConfig;
