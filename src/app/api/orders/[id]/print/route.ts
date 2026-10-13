import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PrintAction =
  | "claim"
  | "complete"
  | "fail"
  | "reprint"
  | "enqueue-reprint"
  | "enqueue-retry";

function isPrintAction(value: unknown): value is PrintAction {
  return (
    value === "claim" ||
    value === "complete" ||
    value === "fail" ||
    value === "reprint" ||
    value === "enqueue-reprint" ||
    value === "enqueue-retry"
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { action?: unknown; error?: unknown };

    if (!isPrintAction(body.action)) {
      return NextResponse.json({ error: "Ação de impressão inválida." }, { status: 400 });
    }

    const supabase = await createClient();

    if (
      body.action === "enqueue-reprint" ||
      body.action === "enqueue-retry"
    ) {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: "Sessão administrativa não encontrada." },
          { status: 401 },
        );
      }

      const requestedBy =
        authData.user.email ?? authData.user.id ?? "administrador";
      const { data, error } = await supabase.rpc("request_order_reprint", {
        p_order_id: id,
        p_requested_by: requestedBy,
      });

      if (error) throw new Error(error.message);

      return NextResponse.json({
        jobId: data,
        message:
          body.action === "enqueue-retry"
            ? "Nova tentativa enviada para a fila do PrintNode."
            : "Reimpressão enviada para a fila do PrintNode.",
      });
    }

    if (body.action === "claim") {
      const { data, error } = await supabase.rpc("claim_order_print", {
        p_order_id: id,
      });

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({ claimed: data === true });
    }

    const functionName =
      body.action === "complete"
        ? "complete_order_print"
        : body.action === "fail"
          ? "fail_order_print"
          : "register_order_reprint";
    const parameters: Record<string, string> = { p_order_id: id };

    if (body.action === "fail") {
      parameters.p_error =
        typeof body.error === "string" ? body.error.slice(0, 500) : "Falha de impressão";
    }

    const { error } = await supabase.rpc(functionName, parameters);
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a impressão.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
