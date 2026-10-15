import "server-only";
import { initialCatalog } from "@/data/menu";
import { createClient } from "@/lib/supabase/server";
import { validateCatalog } from "./validation";

export async function getPublishedCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalog_settings").select("snapshot, updated_at").eq("id", "main").abortSignal(AbortSignal.timeout(6000)).retry(false).single();
  if (error) throw error;
  // null significa usar o catálogo versionado. Erro de banco nunca vira dados falsos.
  return { catalog: data.snapshot === null ? initialCatalog : validateCatalog(data.snapshot), updatedAt: data.updated_at };
}
