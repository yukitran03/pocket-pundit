import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // grpc-js + proto files must stay as real node_modules / files on the server.
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader", "@mysten-incubation/memwal", "@electric-sql/pglite"],
  outputFileTracingIncludes: { "/api/**": ["./proto/**/*"] },
  poweredByHeader: false,
};

export default nextConfig;
