import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { createOrderWriter } from "@/lib/supabase/order-writer";
import { apiError, assertUuid, HttpError, noStore } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    assertUuid(id);
    const body = await request.json();
    const action = body?.action;
    if (!["claim", "complete", "fail", "reprint", "enqueue-reprint", "enqueue-retry"].includes(action)) throw new HttpError(400, "Ação de impressão inválida.");
    // RPCs privilegiadas somente após a autorização administrativa.
    const supabase = createOrderWriter();
    if (action === "enqueue-reprint" || action === "enqueue-retry") {
      const { data, error } = await supabase.rpc("request_order_reprint", { p_order_id: id, p_requested_by: user.email ?? user.id });
      if (error) throw error;
      return NextResponse.json({ jobId: data, message: "Impressão enviada para a fila do PrintNode." }, { headers: noStore });
    }
    const functionName = action === "claim" ? "claim_order_print" : action === "complete" ? "complete_order_print" : action === "fail" ? "fail_order_print" : "register_order_reprint";
    const parameters: Record<string, string> = { p_order_id: id };
    if (action === "fail") parameters.p_error = typeof body.error === "string" ? body.error.slice(0, 500) : "Falha de impressão";
    const { data, error } = await supabase.rpc(functionName, parameters);
    if (error) throw error;
    return NextResponse.json(action === "claim" ? { claimed: data === true } : { ok: true }, { headers: noStore });
  } catch (error) {
    return apiError(error, "order-print", "Não foi possível registrar a impressão. O pedido permanece salvo.");
  }
}
