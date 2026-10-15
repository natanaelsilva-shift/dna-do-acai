import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { createOrderWriter } from "@/lib/supabase/order-writer";
import { apiError, HttpError, noStore } from "@/lib/server/http";

type DatabasePrintSettings = { automatic_enabled: boolean; store_name: string; paper_width: number; characters_per_line: number; max_attempts: number; updated_at: string };
function normalizeSettings(value: unknown) {
  const row = (Array.isArray(value) ? value[0] : value) as DatabasePrintSettings | null;
  if (!row) throw new Error("PRINT_SETTINGS_MISSING");
  return { automaticEnabled: row.automatic_enabled, storeName: row.store_name, paperWidth: row.paper_width === 58 ? 58 : 80, charactersPerLine: row.characters_per_line, maxAttempts: row.max_attempts, updatedAt: row.updated_at };
}
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await createOrderWriter().rpc("get_print_settings");
    if (error) throw error;
    return NextResponse.json({ settings: normalizeSettings(data) }, { headers: noStore });
  } catch (error) {
    return apiError(error, "printing-settings-read", "A impressão automática está indisponível. Verifique a configuração do serviço; os pedidos continuam disponíveis.");
  }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (typeof body?.automaticEnabled !== "boolean") throw new HttpError(400, "Informe se a impressão automática deve ficar ativa.");
    const { data, error } = await createOrderWriter().rpc("set_print_automatic_enabled", { p_enabled: body.automaticEnabled });
    if (error) throw error;
    return NextResponse.json({ settings: normalizeSettings(data) }, { headers: noStore });
  } catch (error) {
    return apiError(error, "printing-settings-write", "Não foi possível alterar a impressão automática.");
  }
}
