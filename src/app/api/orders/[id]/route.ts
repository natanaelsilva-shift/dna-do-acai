import { NextResponse } from "next/server";
import { isOrderStatus, type OrderStatus } from "@/data/orders";
import { updateLocalOrder } from "@/lib/orders/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type OrderUpdateData = {
  updated_at: string;
  status?: string;
  delivery_fee?: number;
  total?: number;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: unknown; delivery_fee?: unknown };
    const statusValue = typeof body.status === "string" ? body.status : undefined;
    const status: OrderStatus | undefined =
      statusValue && isOrderStatus(statusValue) ? statusValue : undefined;
    const deliveryFee = typeof body.delivery_fee === "number" ? body.delivery_fee : undefined;

    if (statusValue && !status) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    if (deliveryFee !== undefined && (deliveryFee < 0 || !Number.isInteger(deliveryFee))) {
      return NextResponse.json({ error: "Taxa de entrega inválida." }, { status: 400 });
    }

    const updateData: OrderUpdateData = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (deliveryFee !== undefined) {
      updateData.delivery_fee = deliveryFee;
    }

    if (!isSupabaseConfigured()) {
      const localOrder = await updateLocalOrder(id, {
        status,
        delivery_fee: deliveryFee,
      });

      return NextResponse.json({ order: localOrder, storage: "local" });
    }

    const supabase = await createClient();

    if (deliveryFee !== undefined) {
      const order = await supabase.from("orders").select("subtotal").eq("id", id).single();
      if (order.data) {
        updateData.total = order.data.subtotal + deliveryFee;
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível atualizar o pedido.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
