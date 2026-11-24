import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Server code reads these files at runtime with fs. Vercel only ships files it can trace,
  // so list them here or the deployed pages and API routes cannot find their config.
  outputFileTracingIncludes: {
    "/**": ["./config/**/*", "./content/about-kb/*", "./docs/POC_SCORECARD.md", "./evals/golden-set.json"],
  },
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
};

export default nextConfig;
