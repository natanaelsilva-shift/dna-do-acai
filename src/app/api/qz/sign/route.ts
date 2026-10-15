import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { apiError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const privateKey = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    if (!privateKey) {
      return NextResponse.json({ error: "Chave de assinatura QZ não configurada." }, { status: 503 });
    }

    const body = (await request.json()) as { data?: unknown };
    if (typeof body.data !== "string" || body.data.length === 0 || body.data.length > 1_000_000) {
      return NextResponse.json({ error: "Conteúdo de assinatura inválido." }, { status: 400 });
    }

    const qzRequest = JSON.parse(body.data) as { call?: unknown; timestamp?: unknown; params?: unknown };
    if (typeof qzRequest.call !== "string" || typeof qzRequest.timestamp !== "number") {
      return NextResponse.json({ error: "Solicitação QZ inválida." }, { status: 400 });
    }

    const signer = createSign("SHA512");
    signer.update(body.data, "utf8");
    signer.end();
    const signature = signer.sign(privateKey, "base64");

    return NextResponse.json({ signature }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "qz-sign", "Não foi possível autorizar a impressão QZ. Verifique a configuração do serviço.");
  }
}
