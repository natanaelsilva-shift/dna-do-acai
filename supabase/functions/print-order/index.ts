import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildEscPosReceipt,
  buildTestOrder,
  type ReceiptConfig,
  type ReceiptOrder,
} from "../_shared/receipt.ts";

type PrintJob = {
  id: string;
  order_id: string | null;
  kind: "automatic" | "manual" | "test";
  status: "pending" | "processing" | "printed" | "failed";
  attempts: number;
  requested_by: string | null;
};

type PrintSettings = {
  automatic_enabled: boolean;
  store_name: string;
  paper_width: 58 | 80;
  characters_per_line: number;
  max_attempts: number;
};

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function getWebhookSecret(request: Request) {
  const directHeader = request.headers.get("x-print-webhook-secret")?.trim();
  if (directHeader) return directHeader;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLocaleLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function extractJobId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const body = payload as Record<string, unknown>;
  const record =
    body.record && typeof body.record === "object"
      ? (body.record as Record<string, unknown>)
      : body;
  const value = record.id ?? record.job_id;
  return typeof value === "string" ? value : "";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function getProviderJobId(payload: unknown) {
  if (typeof payload === "number" || typeof payload === "string") {
    return String(payload);
  }
  if (!payload || typeof payload !== "object") return "";

  const body = payload as Record<string, unknown>;
  const value = body.id ?? body.jobId ?? body.job_id;
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
}

function isDefinitelyRetryable(status: number) {
  return status === 408 || status === 425 || status === 429 || status === 502 ||
    status === 503 || status === 504;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const expectedSecret = Deno.env.get("PRINT_WEBHOOK_SECRET")?.trim() ?? "";
  const receivedSecret = getWebhookSecret(request);

  if (
    !expectedSecret ||
    !receivedSecret ||
    !safeEqual(receivedSecret, expectedSecret)
  ) {
    return jsonResponse({ error: "Origem do webhook não autorizada." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const printNodeApiKey = Deno.env.get("PRINTNODE_API_KEY")?.trim() ?? "";
  const printerId = Number(Deno.env.get("PRINTNODE_PRINTER_ID")?.trim() ?? "");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase não configurado na Edge Function." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Corpo JSON inválido." }, 400);
  }

  const jobId = extractJobId(payload);
  if (!jobId) {
    return jsonResponse({ error: "print_job id não informado." }, 400);
  }

  const { data: claimedJobData, error: claimError } = await supabase.rpc(
    "claim_print_job",
    { p_job_id: jobId },
  );

  if (claimError) {
    return jsonResponse({ error: claimError.message, jobId }, 500);
  }

  const claimedJob = claimedJobData as PrintJob | null;
  if (!claimedJob?.id) {
    return jsonResponse({
      ok: true,
      duplicate: true,
      message: "Trabalho já processado ou recebido simultaneamente.",
      jobId,
    });
  }

  const failJob = async (message: string) => {
    await supabase
      .from("print_jobs")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
      })
      .eq("id", claimedJob.id)
      .eq("status", "processing");
  };

  if (!printNodeApiKey || !Number.isInteger(printerId) || printerId <= 0) {
    const message =
      "PRINTNODE_API_KEY ou PRINTNODE_PRINTER_ID não configurado.";
    await failJob(message);
    return jsonResponse({ error: message, jobId }, 503);
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from("print_settings")
    .select(
      "automatic_enabled, store_name, paper_width, characters_per_line, max_attempts",
    )
    .eq("id", "main")
    .single();

  if (settingsError || !settingsData) {
    const message =
      settingsError?.message ?? "Configuração de impressão não encontrada.";
    await failJob(message);
    return jsonResponse({ error: message, jobId }, 500);
  }

  const settings = settingsData as PrintSettings;
  if (claimedJob.kind === "automatic" && !settings.automatic_enabled) {
    const message = "Impressão automática desativada no painel.";
    await failJob(message);
    return jsonResponse({ error: message, jobId }, 409);
  }

  let order: ReceiptOrder;
  if (claimedJob.kind === "test") {
    order = buildTestOrder();
  } else {
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", claimedJob.order_id)
      .single();

    if (orderError || !orderData) {
      const message = orderError?.message ?? "Pedido não encontrado.";
      await failJob(message);
      return jsonResponse({ error: message, jobId }, 404);
    }
    order = orderData as ReceiptOrder;
  }

  const config: ReceiptConfig = {
    storeName: settings.store_name,
    paperWidth: settings.paper_width,
    charactersPerLine: settings.characters_per_line,
  };
  const content = toBase64(
    buildEscPosReceipt(order, config, {
      reprint: claimedJob.kind === "manual",
      test: claimedJob.kind === "test",
    }),
  );
  const maxAttempts = Math.max(1, Math.min(settings.max_attempts, 5));
  let attempt = Math.max(1, claimedJob.attempts);
  let lastError = "";

  while (attempt <= maxAttempts) {
    if (attempt > claimedJob.attempts) {
      await supabase
        .from("print_jobs")
        .update({ attempts: attempt })
        .eq("id", claimedJob.id)
        .eq("status", "processing");
    }

    let printResponse: Response;
    try {
      printResponse = await fetch("https://api.printnode.com/printjobs", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${printNodeApiKey}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerId,
          title:
            `${settings.store_name} - Pedido ${String(order.order_number).padStart(4, "0")}`,
          contentType: "raw_base64",
          content,
          source: "DNA do Açaí / Supabase Edge Function",
          expireAfter: 24 * 60 * 60,
        }),
      });
    } catch (error) {
      lastError =
        `Resposta do PrintNode desconhecida; confira o painel antes de tentar novamente. ${
          error instanceof Error ? error.message : String(error)
        }`;
      break;
    }

    const responseText = await printResponse.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // PrintNode pode responder apenas com o id numérico em texto.
    }

    if (printResponse.ok) {
      const providerJobId =
        getProviderJobId(responseBody) || responseText.trim() || null;
      const printedAt = new Date().toISOString();
      const { error: completeError } = await supabase
        .from("print_jobs")
        .update({
          status: "printed",
          provider_job_id: providerJobId,
          provider_response: responseBody,
          error_message: null,
          printed_at: printedAt,
        })
        .eq("id", claimedJob.id)
        .eq("status", "processing");

      if (completeError) {
        return jsonResponse(
          {
            error:
              "PrintNode aceitou a comanda, mas o resultado não pôde ser registrado. Não reenvie sem conferir o PrintNode.",
            providerJobId,
            jobId,
          },
          500,
        );
      }

      return jsonResponse({
        ok: true,
        jobId,
        providerJobId,
        attempts: attempt,
      });
    }

    lastError =
      `PrintNode recusou a comanda (${printResponse.status}): ${
        responseText.slice(0, 700) || "sem detalhes"
      }`;

    if (!isDefinitelyRetryable(printResponse.status) || attempt >= maxAttempts) {
      break;
    }

    await wait(attempt * 1500);
    attempt += 1;
  }

  await failJob(lastError || "Falha de impressão sem detalhes.");
  return jsonResponse(
    {
      error: lastError || "Falha de impressão sem detalhes.",
      jobId,
      attempts: attempt,
    },
    502,
  );
});
