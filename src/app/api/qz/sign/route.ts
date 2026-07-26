import { createSign } from "node:crypto";
import { NextResponse } from "next/server";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }

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
    const message = error instanceof Error ? error.message : "Falha ao assinar solicitação QZ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
