import type { NextConfig } from "next";

const apiOrigin = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

if (
  process.env.VERCEL &&
  !process.env.API_BASE_URL &&
  !process.env.NEXT_PUBLIC_API_BASE_URL
) {
  throw new Error(
    "Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL for this Vercel environment.",
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/backend/v1/:path*", destination: `${apiOrigin}/v1/:path*` },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
