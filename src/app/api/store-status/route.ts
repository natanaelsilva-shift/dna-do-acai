import { NextResponse } from "next/server";
import { isStoreStatus, type StoreStatus } from "@/data/store-status";
import { getStoreStatus, updateStoreStatus } from "@/lib/store-status/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { apiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  try {
    return NextResponse.json(await getStoreStatus(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return apiError(error, "store-status-read", "Não conseguimos confirmar o funcionamento da loja agora. Tente novamente em instantes.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = asRecord(await request.json());
    const status = body.status;

    if (!isStoreStatus(status)) {
      return NextResponse.json(
        { error: "Status da loja invalido." },
        { status: 400 },
      );
    }

    const data = await updateStoreStatus(status as StoreStatus);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return apiError(error, "store-status-write", "Não foi possível atualizar o status da loja. Tente novamente.");
  }
}
