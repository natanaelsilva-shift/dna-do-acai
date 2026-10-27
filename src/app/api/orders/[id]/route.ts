import { after, NextResponse } from "next/server";
import { isOrderStatus } from "@/data/orders";
import { requireAdmin } from "@/lib/supabase/admin";
import { apiError, assertUuid, HttpError, noStore } from "@/lib/server/http";
import { notifyAtendeiaStatus } from "@/lib/integrations/atendeia/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin(request);
    const { id } = await context.params;
    assertUuid(id);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Dados inválidos.");
    if (body.status !== undefined && (typeof body.status !== "string" || !isOrderStatus(body.status))) throw new HttpError(400, "Status inválido.");
    if (body.delivery_fee !== undefined && (!Number.isSafeInteger(body.delivery_fee) || body.delivery_fee < 0 || body.delivery_fee > 100_000)) throw new HttpError(400, "Taxa de entrega inválida.");
    if (body.status === undefined && body.delivery_fee === undefined) throw new HttpError(400, "Informe o status ou a taxa de entrega.");
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) update.status = body.status;
    if (body.delivery_fee !== undefined) {
      const previous = await supabase.from("orders").select("subtotal").eq("id", id).maybeSingle();
      if (previous.error) throw previous.error;
      if (!previous.data) throw new HttpError(404, "Pedido não encontrado.");
      update.delivery_fee = body.delivery_fee;
      update.total = previous.data.subtotal + body.delivery_fee;
    }
    const { data, error } = await supabase.from("orders").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Pedido não encontrado.");
    // Pedido do WhatsApp: avisa o AtendeIA depois da resposta (não atrasa nem quebra o painel).
    if (body.status !== undefined) after(() => notifyAtendeiaStatus(data));
    return NextResponse.json({ order: data }, { headers: noStore });
  } catch (error) {
    return apiError(error, "orders-update", "Não foi possível atualizar o pedido. Tente novamente.");
  }
}
