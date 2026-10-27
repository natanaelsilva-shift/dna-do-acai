import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WHATSAPP_BUSINESS_PHONE_NUMBER, type CreateOrderPayload } from "@/data/orders";
import { buildWhatsAppBusinessOrderPayload } from "@/lib/whatsapp/business";

export const ORDER_SUMMARY_COLUMNS = "id, order_number, created_at, status";

export type OrderSummary = { id: string; order_number: number; created_at: string; status: string };

export async function findOrderByRequestId(supabase: SupabaseClient, requestId: string) {
  const { data, error } = await supabase.from("orders").select(ORDER_SUMMARY_COLUMNS).eq("request_id", requestId).maybeSingle();
  if (error) throw error;
  return data as OrderSummary | null;
}

/**
 * Grava um pedido já validado e precificado no servidor. Usado pelo site e pela
 * integração do WhatsApp: mesma tabela, mesmo trigger de impressão e mesmo painel.
 * Duas tentativas simultâneas com o mesmo requestId devolvem o mesmo pedido.
 */
export async function insertOrder(
  supabase: SupabaseClient,
  order: CreateOrderPayload,
  opts: { requestId?: string | null; payloadExtra?: Record<string, unknown> } = {},
): Promise<{ order: OrderSummary; created: boolean }> {
  const { data, error } = await supabase.from("orders").insert({
    request_id: opts.requestId ?? null,
    customer_name: order.customerName, customer_phone: order.customerPhone,
    delivery_method: order.deliveryMethod, address: order.address || null, neighborhood: order.neighborhood || null,
    items: order.items, subtotal: order.subtotal, delivery_fee: null, total: order.total,
    payment_method: order.paymentMethod, payment_label: order.paymentLabel, change_for: order.changeFor || null,
    notes: order.notes || null, status: "Novo", whatsapp_business_phone: WHATSAPP_BUSINESS_PHONE_NUMBER,
    whatsapp_payload: { ...buildWhatsAppBusinessOrderPayload(order), ...(opts.payloadExtra ?? {}) },
  }).select(ORDER_SUMMARY_COLUMNS).single();
  if (error) {
    // Concorrência entre duas tentativas com o mesmo identificador.
    if (opts.requestId && error.code === "23505") {
      const previous = await findOrderByRequestId(supabase, opts.requestId);
      if (previous) return { order: previous, created: false };
    }
    throw error;
  }
  return { order: data as OrderSummary, created: true };
}
