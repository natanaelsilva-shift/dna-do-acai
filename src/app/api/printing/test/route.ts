import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { createOrderWriter } from "@/lib/supabase/order-writer";
import { apiError, noStore } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const { data, error } = await createOrderWriter().rpc("request_test_print", { p_requested_by: user.email ?? user.id });
    if (error) throw error;
    return NextResponse.json({ jobId: data, message: "Comanda de teste enviada para a fila do PrintNode." }, { headers: noStore });
  } catch (error) {
    return apiError(error, "printing-test", "Não foi possível criar a impressão de teste. Verifique a configuração do serviço.");
  }
}
