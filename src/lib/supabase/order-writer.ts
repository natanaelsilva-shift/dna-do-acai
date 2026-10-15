import "server-only";
import { createClient } from "@supabase/supabase-js";
import { legacyKeyRole, SupabaseConfigurationError, validateSupabaseUrl } from "./config";

// Cliente exclusivo do servidor para inserir pedidos já validados.
// Não reutilizar cookies/sessões do navegador nem expor esta chave com NEXT_PUBLIC.
export function createOrderWriter() {
  const url = validateSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || /\s/.test(key) || (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key) && legacyKeyRole(key) !== "service_role")) {
    throw new SupabaseConfigurationError("SUPABASE_SECRET_KEY ausente ou inválida. Configure uma chave privada secret ou service_role apenas no servidor.");
  }
  if (key === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) throw new SupabaseConfigurationError("A chave privada foi configurada como chave pública. Remova a exposição e rotacione a credencial.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
