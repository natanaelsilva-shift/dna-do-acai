import { NextResponse } from "next/server";
import { isStoreStatus, type StoreStatus } from "@/data/store-status";
import { getStoreStatus, updateStoreStatus } from "@/lib/store-status/server";

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
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar o status da loja.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
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
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o status da loja.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
