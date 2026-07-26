import { isStoreStatus, type StoreStatus, type StoreStatusPayload } from "@/data/store-status";
import { createClient } from "@/lib/supabase/server";

const STORE_SETTINGS_ID = "main";

type StoreSettingsRow = {
  status: unknown;
  updated_at: unknown;
};

function toStoreStatusPayload(row: StoreSettingsRow): StoreStatusPayload {
  if (!isStoreStatus(row.status)) {
    throw new Error("O banco retornou um status de loja inválido.");
  }

  return {
    status: row.status,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function getStoreStatus(): Promise<StoreStatusPayload> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select("status, updated_at")
    .eq("id", STORE_SETTINGS_ID)
    .single();

  if (error) {
    throw new Error(`Não foi possível ler o status da loja no banco: ${error.message}`);
  }

  return toStoreStatusPayload(data as StoreSettingsRow);
}

export async function updateStoreStatus(status: StoreStatus): Promise<StoreStatusPayload> {
  const supabase = await createClient();
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("store_settings")
    .update({ status, updated_at: updatedAt })
    .eq("id", STORE_SETTINGS_ID)
    .select("status, updated_at")
    .single();

  if (error) {
    throw new Error(`Não foi possível atualizar o status da loja no banco: ${error.message}`);
  }

  return toStoreStatusPayload(data as StoreSettingsRow);
}
