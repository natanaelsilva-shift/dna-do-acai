import "server-only";
import { HttpError } from "@/lib/server/http";
import { signRequest, SIGNATURE_HEADER, verifySignature } from "./signature";
import { isAtendeiaOrder } from "./protocol";

const MAX_BODY = 100_000;

/** Lê o corpo e confere a assinatura do AtendeIA. Sem segredo configurado, a integração fica desligada. */
export async function readSignedRequest(request: Request) {
  const body = await request.text();
  if (body.length > MAX_BODY) throw new HttpError(413, "Requisição muito grande.");
  const path = new URL(request.url).pathname;
  const check = verifySignature(process.env.ATENDEIA_INTEGRATION_SECRET, request.headers.get(SIGNATURE_HEADER), request.method, path, body);
  if (!check.ok) {
    if (check.reason === "not_configured") throw new HttpError(503, "Integração com o AtendeIA desativada.", "INTEGRATION_DISABLED");
    throw new HttpError(401, "Assinatura inválida.", "INVALID_SIGNATURE");
  }
  return body;
}

export function parseJsonObject(body: string) {
  const value = body ? JSON.parse(body) : {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Dados inválidos.");
  return value as Record<string, unknown>;
}

/**
 * Avisa o AtendeIA da mudança de status de um pedido feito pelo WhatsApp (melhor esforço).
 * Desligado sem ATENDEIA_STATUS_WEBHOOK_URL. Falhas nunca afetam o painel.
 */
export async function notifyAtendeiaStatus(order: { id: string; order_number: number; status: string; whatsapp_payload: unknown; delivery_fee?: number | null; total?: number }) {
  const url = process.env.ATENDEIA_STATUS_WEBHOOK_URL?.trim();
  const secret = process.env.ATENDEIA_INTEGRATION_SECRET?.trim();
  if (!url || !secret || !isAtendeiaOrder(order.whatsapp_payload)) return;
  const origin = (order.whatsapp_payload as { origin: { requestId?: string } }).origin;
  const body = JSON.stringify({
    event: "order.status", orderId: order.id, orderNumber: order.order_number, requestId: origin.requestId ?? null,
    status: order.status, deliveryFee: order.delivery_fee ?? null, total: order.total ?? null, at: new Date().toISOString(),
  });
  try {
    const target = new URL(url);
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signRequest(secret, "POST", target.pathname, body) },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[DNA:atendeia-status]", `HTTP_${res.status}`);
  } catch (error) {
    console.error("[DNA:atendeia-status]", error instanceof Error ? error.name : "UNAVAILABLE");
  }
}
