export class SupabaseConfigurationError extends Error {
  readonly code = "SUPABASE_CONFIGURATION";
}

export function validateSupabaseUrl(value: string | undefined) {
  const url = value?.trim() ?? "";
  try {
    const parsed = new URL(url);
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (/\s/.test(url) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" ||
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) throw new Error();
    return parsed.origin;
  } catch {
    throw new SupabaseConfigurationError("NEXT_PUBLIC_SUPABASE_URL ausente ou inválida.");
  }
}

export function legacyKeyRole(key: string) {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))).role as unknown;
  } catch { return null; }
}

export function validatePublicKey(value: string | undefined) {
  const key = value?.trim() ?? "";
  if (!/\s/.test(key) && (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || legacyKeyRole(key) === "anon")) return key;
  throw new SupabaseConfigurationError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente ou inválida. Use uma chave pública publishable ou anon.");
}

export function getPublicSupabaseConfig() {
  // Referências explícitas permitem a substituição segura pelo build do Next.
  return {
    url: validateSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    key: validatePublicKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function isSupabaseConfigured() {
  try { getPublicSupabaseConfig(); return true; } catch { return false; }
}
