import { createHmac, timingSafeEqual } from "node:crypto";

// Assinatura das chamadas entre o AtendeIA e a loja (nos dois sentidos).
// Cabeçalho: x-atendeia-signature: t=<segundos unix>,v1=<hex HMAC-SHA256>
// Conteúdo assinado: "<t>.<MÉTODO>.<caminho>.<corpo>". O segredo fica só no servidor.

export const SIGNATURE_HEADER = "x-atendeia-signature";
export const MAX_SKEW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

export function signRequest(secret: string, method: string, path: string, body: string, now = Date.now()) {
  const t = Math.floor(now / 1000);
  const v1 = createHmac("sha256", secret.trim()).update(`${t}.${method.toUpperCase()}.${path}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "not_configured" | "missing" | "expired" | "invalid" };

export function verifySignature(secret: string | undefined, header: string | null, method: string, path: string, body: string, now = Date.now()): SignatureCheck {
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) return { ok: false, reason: "not_configured" };
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isSafeInteger(t) || !/^[0-9a-f]{64}$/.test(parts.v1 ?? "")) return { ok: false, reason: "invalid" };
  if (Math.abs(Math.floor(now / 1000) - t) > MAX_SKEW_SECONDS) return { ok: false, reason: "expired" };
  const expected = createHmac("sha256", secret.trim()).update(`${t}.${method.toUpperCase()}.${path}.${body}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? { ok: true } : { ok: false, reason: "invalid" };
}
