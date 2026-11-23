import type { NextConfig } from "next";

// In a Codespace the browser reaches the dev server through a forwarded
// *.app.github.dev address, whose origin Next would otherwise reject for dev
// assets and Server Actions (the pré-reserva buttons).
const CODESPACES = "*.app.github.dev";

const nextConfig: NextConfig = {
  allowedDevOrigins: [CODESPACES],
  experimental: { serverActions: { allowedOrigins: [CODESPACES] } },
};

export default nextConfig;
