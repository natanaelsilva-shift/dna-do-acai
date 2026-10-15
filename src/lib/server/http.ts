import "server-only";
import { NextResponse } from "next/server";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) { super(message); }
}

export const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export function reportServerError(context: string, error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNAVAILABLE";
  // Nunca imprimir respostas, payloads, tokens, dados pessoais ou URLs de requisições.
  console.error(`[DNA:${context}]`, error instanceof SupabaseConfigurationError ? error.message :
    /^[A-Z0-9_]{1,40}$/.test(code) ? code : "UNAVAILABLE");
}

export function apiError(error: unknown, context: string, fallback: string) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: noStore });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Dados inválidos. Revise o formulário." }, { status: 400, headers: noStore });
  reportServerError(context, error);
  return NextResponse.json({ error: fallback, code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: noStore });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  const host = request.headers.get("host") ?? target.host;
  // O proxy do Next pode reescrever request.url para o hostname interno.
  if (origin) {
    let source: URL;
    try { source = new URL(origin); } catch { throw new HttpError(403, "Origem não autorizada."); }
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || target.protocol.slice(0, -1);
    if (source.host !== host || source.protocol !== `${protocol}:`) throw new HttpError(403, "Origem não autorizada.");
  }
}

export function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, "Identificador inválido.");
}
