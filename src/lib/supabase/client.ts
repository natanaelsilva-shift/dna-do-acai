import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config";
export { isSupabaseConfigured } from "./config";

export function createClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createBrowserClient(url, key);
}
