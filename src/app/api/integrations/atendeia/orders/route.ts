import { NextResponse } from "next/server";
import { getPublishedCatalog } from "@/lib/catalog/server";
import { getStoreStatus } from "@/lib/store-status/server";
import { OrderValidationError, validateCheckout } from "@/lib/checkout/validation";
import { findOrderByRequestId, insertOrder } from "@/lib/orders/create";
import { createOrderWriter } from "@/lib/supabase/order-writer";
import { ORDER_ORIGIN, ProtocolError, publicItems, quoteProtocolItems } from "@/lib/integrations/atendeia/protocol";
import { parseJsonObject, readSignedRequest } from "@/lib/integrations/atendeia/server";
import { apiError, assertUuid, HttpError, noStore } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Pedido confirmado pelo cliente no WhatsApp. Entra na MESMA tabela do site:
 * aparece no painel (/admin/pedidos), dispara o alerta e a impressão automática
 * (trigger do banco, uma vez por pedido). Valores recalculados aqui; o requestId
 * torna a chamada idempotente (retentativas e webhooks repetidos não duplicam).
 */
export async function POST(request: Request) {
  try {
    const body = parseJsonObject(await readSignedRequest(request));
    const requestId = body.requestId;
    if (typeof requestId !== "string") throw new HttpError(400, "Identificador do pedido ausente.");
    assertUuid(requestId);
    const supabase = createOrderWriter();
    const previous = await findOrderByRequestId(supabase, requestId);
    if (previous) return NextResponse.json({ order: previous, duplicate: true }, { status: 200, headers: noStore });

    const store = await getStoreStatus();
    if (store.status === "closed") throw new HttpError(409, "A loja está fechada no momento.", "STORE_CLOSED");
    const { catalog } = await getPublishedCatalog();
    const quote = quoteProtocolItems(body.items, catalog);
    if (body.expectedSubtotal !== quote.subtotal) {
      return NextResponse.json({ code: "PRICE_CHANGED", error: "Os valores do pedido mudaram. Confirme novamente.", quote: { items: publicItems(quote.items), subtotal: quote.subtotal, total: quote.total } }, { status: 409, headers: noStore });
    }
    const customer = (body.customer ?? {}) as Record<string, unknown>;
    const delivery = (body.delivery ?? {}) as Record<string, unknown>;
    const payment = (body.payment ?? {}) as Record<string, unknown>;
    const source = (body.source ?? {}) as Record<string, unknown>;
    // Pendência de pagamento visível no painel e na comanda (o pedido nunca entra como pago).
    const pendencia = payment.method === "pix" ? "Pix: aguardando confirmação do pagamento pela loja."
      : payment.method === "card" ? "Cartão: responsável deve dar continuidade ao pagamento com o cliente."
      : "Pagamento na entrega/retirada.";
    const notes = [
      `Pedido feito pelo WhatsApp (AtendeIA). ${pendencia}`,
      text(body.notes, 800) && `Observações do cliente: ${text(body.notes, 800)}`,
    ].filter(Boolean).join("\n");
    const checkout = validateCheckout({
      customerName: customer.name, customerPhone: customer.phone,
      deliveryMethod: delivery.method, address: delivery.address, addressNumber: delivery.number,
      neighborhood: delivery.neighborhood, addressComplement: delivery.complement, addressReference: delivery.reference,
      paymentMethod: payment.method, changeFor: payment.changeFor, notes,
    }, quote.subtotal);
    const order = { ...checkout, items: quote.items, subtotal: quote.subtotal, deliveryFee: null, total: quote.total };
    const saved = await insertOrder(supabase, order, {
      requestId,
      payloadExtra: {
        origin: {
          system: ORDER_ORIGIN, channel: "whatsapp", requestId,
          conversationRef: text(source.conversationRef, 64) || null,
          paymentStatus: "pending",
        },
      },
    });
    return NextResponse.json({ order: saved.order, duplicate: !saved.created, items: publicItems(quote.items), subtotal: quote.subtotal, total: quote.total }, { status: saved.created ? 201 : 200, headers: noStore });
  } catch (error) {
    if (error instanceof ProtocolError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400, headers: noStore });
    if (error instanceof OrderValidationError) return NextResponse.json({ error: error.message, code: "CHECKOUT_INVALID" }, { status: 400, headers: noStore });
    return apiError(error, "atendeia-orders", "Não foi possível registrar o pedido agora.");
  }
}
