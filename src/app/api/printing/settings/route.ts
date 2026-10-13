import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DatabasePrintSettings = {
  automatic_enabled: boolean;
  store_name: string;
  paper_width: number;
  characters_per_line: number;
  max_attempts: number;
  updated_at: string;
};

function normalizeSettings(value: unknown) {
  const row = (Array.isArray(value) ? value[0] : value) as
    | DatabasePrintSettings
    | null;

  if (!row) return null;

  return {
    automaticEnabled: row.automatic_enabled,
    storeName: row.store_name,
    paperWidth: row.paper_width === 58 ? 58 : 80,
    charactersPerLine: row.characters_per_line,
    maxAttempts: row.max_attempts,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { supabase, user: null };
  }

  return { supabase, user: data.user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
      return NextResponse.json(
        { error: "Sessão administrativa não encontrada." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase.rpc("get_print_settings");
    if (error) throw new Error(error.message);

    const settings = normalizeSettings(data);
    if (!settings) throw new Error("Configuração de impressão não encontrada.");

    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar a configuração de impressão.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { automaticEnabled?: unknown };
    if (typeof body.automaticEnabled !== "boolean") {
      return NextResponse.json(
        { error: "Informe se a impressão automática deve ficar ativa." },
        { status: 400 },
      );
    }

    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
      return NextResponse.json(
        { error: "Sessão administrativa não encontrada." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase.rpc(
      "set_print_automatic_enabled",
      { p_enabled: body.automaticEnabled },
    );
    if (error) throw new Error(error.message);

    const settings = normalizeSettings(data);
    if (!settings) throw new Error("Configuração de impressão não encontrada.");

    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível alterar a impressão automática.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
