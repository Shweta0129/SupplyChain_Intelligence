import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This repo sits under a user directory that has its own lockfile; pin the
  // tracing root so Next does not walk up and pick the wrong one.
  outputFileTracingRoot: import.meta.dirname,
  // The columnar dataset is a pre-gzipped binary blob. Serve it with a long
  // immutable cache — the filename never changes but the content only changes
  // when the build-time aggregation reruns, which is a redeploy anyway.
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, s-maxage=31536000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
