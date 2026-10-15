import { NextResponse } from "next/server";
import { WHATSAPP_BUSINESS_PHONE_NUMBER } from "@/data/orders";
import { getStoreStatus } from "@/lib/store-status/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { createOrderWriter } from "@/lib/supabase/order-writer";
import { OrderPricingError, quoteOrderItems } from "@/lib/orders/pricing";
import { OrderValidationError, validateCheckout } from "@/lib/checkout/validation";
import { apiError, assertSameOrigin, assertUuid, HttpError, noStore } from "@/lib/server/http";
import { buildWhatsAppBusinessOrderPayload } from "@/lib/whatsapp/business";
import { getPublishedCatalog } from "@/lib/catalog/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] }, { headers: noStore });
  } catch (error) {
    return apiError(error, "orders-read", "Não foi possível carregar os pedidos. Tente novamente.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const raw = await request.text();
    if (raw.length > 100_000) throw new HttpError(413, "Pedido muito grande. Reduza os itens ou observações.");
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Pedido inválido.");
    const requestId = body.requestId;
    if (requestId !== undefined) {
      if (typeof requestId !== "string") throw new HttpError(400, "Identificador de envio inválido.");
      assertUuid(requestId);
    }
    const supabase = createOrderWriter();
    // Uma nova tentativa após perda de conexão retorna o mesmo pedido.
    if (requestId) {
      const previous = await supabase.from("orders").select("id, order_number, created_at, status").eq("request_id", requestId).maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data) return NextResponse.json({ order: previous.data }, { status: 200, headers: noStore });
    }
    const storeStatus = await getStoreStatus();
    if (storeStatus.status === "closed") throw new HttpError(409, "No momento estamos fechados. Volte em breve 💜", "STORE_CLOSED");
    const { catalog } = await getPublishedCatalog();
    const quote = quoteOrderItems(body.items, Date.now(), catalog);
    const order = { ...validateCheckout(body, quote.subtotal), items: quote.items, subtotal: quote.subtotal, deliveryFee: null, total: quote.total };
    if (quote.changed || body.subtotal !== quote.subtotal || body.total !== quote.total) {
      return NextResponse.json({ code: "PRICE_CHANGED", error: quote.message, quote }, { status: 409, headers: noStore });
    }
    const { data, error } = await supabase.from("orders").insert({
      request_id: requestId ?? null,
      customer_name: order.customerName, customer_phone: order.customerPhone,
      delivery_method: order.deliveryMethod, address: order.address || null, neighborhood: order.neighborhood || null,
      items: order.items, subtotal: order.subtotal, delivery_fee: null, total: order.total,
      payment_method: order.paymentMethod, payment_label: order.paymentLabel, change_for: order.changeFor || null,
      notes: order.notes || null, status: "Novo", whatsapp_business_phone: WHATSAPP_BUSINESS_PHONE_NUMBER,
      whatsapp_payload: buildWhatsAppBusinessOrderPayload(order),
    }).select("id, order_number, created_at, status").single();
    if (error) {
      // Concorrência entre duas tentativas com o mesmo identificador.
      if (requestId && error.code === "23505") {
        const previous = await supabase.from("orders").select("id, order_number, created_at, status").eq("request_id", requestId).single();
        if (previous.data) return NextResponse.json({ order: previous.data }, { headers: noStore });
      }
      throw error;
    }
    return NextResponse.json({ order: data }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof OrderPricingError || error instanceof OrderValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error, "orders-create", "Não foi possível confirmar seu pedido agora. Tente novamente em instantes.");
  }
}
