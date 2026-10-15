import { NextResponse } from "next/server";
import { getPublishedCatalog } from "@/lib/catalog/server";
import { CatalogValidationError, validateCatalog } from "@/lib/catalog/validation";
import { requireAdmin } from "@/lib/supabase/admin";
import { apiError, HttpError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getPublishedCatalog(), { headers: noStore }); }
  catch (error) { return apiError(error, "catalog-read", "Não foi possível atualizar o cardápio. Tente novamente em instantes."); }
}
export async function PUT(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const raw = await request.text();
    if (raw.length > 500_000) throw new HttpError(413, "O catálogo excede o limite de tamanho.");
    const catalog = validateCatalog(JSON.parse(raw));
    const { error } = await supabase.from("catalog_settings").update({ snapshot: catalog, updated_at: new Date().toISOString() }).eq("id", "main").select("id").single();
    if (error) throw error;
    return NextResponse.json({ catalog }, { headers: noStore });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error, "catalog-publish", "Não foi possível publicar. Seu rascunho permanece neste dispositivo.");
  }
}
