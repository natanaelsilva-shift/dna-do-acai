import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Sessão administrativa não encontrada." },
        { status: 401 },
      );
    }

    const requestedBy =
      authData.user.email ?? authData.user.id ?? "administrador";
    const { data, error } = await supabase.rpc("request_test_print", {
      p_requested_by: requestedBy,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      jobId: data,
      message: "Comanda de teste enviada para a fila do PrintNode.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível criar a impressão de teste.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
