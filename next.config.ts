import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server code reads these files at runtime with fs. Vercel only ships files it can trace,
  // so list them here or the deployed pages and API routes cannot find their config.
  outputFileTracingIncludes: {
    "/**": ["./config/**/*", "./content/about-kb/*", "./docs/POC_SCORECARD.md"],
  },
};

export default nextConfig;
