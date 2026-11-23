import type { NextConfig } from "next";

// In a Codespace the browser reaches the dev server through a forwarded
// *.app.github.dev address. Next would otherwise reject that origin for dev
// assets and Server Actions (the pré-reserva buttons). For Server Actions the
// Codespaces proxy also rewrites the Origin header to localhost:3000 while
// x-forwarded-host keeps the forwarded address, so both must be allowed.
const CODESPACES = "*.app.github.dev";

const nextConfig: NextConfig = {
  allowedDevOrigins: [CODESPACES],
  experimental: {
    serverActions: { allowedOrigins: [CODESPACES, "localhost:3000"] },
  },
};

export default nextConfig;
