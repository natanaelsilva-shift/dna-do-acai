import { NextResponse } from "next/server";
import { getPublishedCatalog } from "@/lib/catalog/server";
import { getStoreStatus } from "@/lib/store-status/server";
import { buildMenu, ProtocolError, publicItems, quoteProtocolItems } from "@/lib/integrations/atendeia/protocol";
import { parseJsonObject, readSignedRequest } from "@/lib/integrations/atendeia/server";
import { apiError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Cotação oficial de um carrinho (não grava nada). Mesmo cálculo do checkout do site.
export async function POST(request: Request) {
  try {
    const body = parseJsonObject(await readSignedRequest(request));
    const [{ catalog, updatedAt }, store] = await Promise.all([getPublishedCatalog(), getStoreStatus()]);
    const now = Date.now();
    const quote = quoteProtocolItems(body.items, catalog, now);
    return NextResponse.json({
      items: publicItems(quote.items), subtotal: quote.subtotal, total: quote.total,
      deliveryFee: null, deliveryFeeMode: "to_be_agreed", storeOpen: store.status === "open",
      version: buildMenu(catalog, store, updatedAt, now).version, serverTime: new Date(now).toISOString(),
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof ProtocolError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400, headers: noStore });
    return apiError(error, "atendeia-quote", "Não foi possível calcular o pedido agora.");
  }
}
