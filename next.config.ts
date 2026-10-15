import type { NextConfig } from "next";

// Interrompe o build antes que o Next possa embutir uma chave privada no JS.
for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith("NEXT_PUBLIC_") || !value?.trim()) continue;
  let role: unknown;
  try { role = JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString()).role; } catch { /* não é JWT */ }
  if (name === "NEXT_PUBLIC_SUPABASE_SECRET_KEY" || name === "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" || value.trim().startsWith("sb_secret_") || role === "service_role") {
    throw new Error(`${name} expõe uma credencial privada. Remova a variável pública e configure SUPABASE_SECRET_KEY apenas no servidor.`);
  }
}

const nextConfig: NextConfig = {
  // O navegador de teste usa cache e tipos próprios, sem disputar o servidor local.
  ...(process.env.NODE_ENV === "development" && process.env.DNA_TEST_CLOCK_FILE
    ? { distDir: "local-data/promotion-tests/.next", typescript: { tsconfigPath: "local-data/promotion-tests/tsconfig.json" } }
    : {}),
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.0.104",
    "192.168.0.108",
  ],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
