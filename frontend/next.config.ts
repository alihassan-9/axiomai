import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async rewrites() {
    // Proxy API calls to the FastAPI backend (Kong/ingress handles this in prod).
    const api = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
