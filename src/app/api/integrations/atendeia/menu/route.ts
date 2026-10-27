import { NextResponse } from "next/server";
import { getPublishedCatalog } from "@/lib/catalog/server";
import { getStoreStatus } from "@/lib/store-status/server";
import { buildMenu } from "@/lib/integrations/atendeia/protocol";
import { readSignedRequest } from "@/lib/integrations/atendeia/server";
import { apiError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Cardápio vigente para o atendimento pelo WhatsApp: produtos ativos, preço de agora
// (promoção só enquanto ativa), complementos, adicionais, status da loja e checkout.
export async function GET(request: Request) {
  try {
    await readSignedRequest(request);
    const [{ catalog, updatedAt }, store] = await Promise.all([getPublishedCatalog(), getStoreStatus()]);
    return NextResponse.json(buildMenu(catalog, store, updatedAt), { headers: noStore });
  } catch (error) {
    return apiError(error, "atendeia-menu", "Cardápio indisponível no momento.");
  }
}
