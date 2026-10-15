import "server-only";
import { createClient } from "./server";
import { assertSameOrigin, HttpError } from "@/lib/server/http";

export async function requireAdmin(request?: Request) {
  if (request) assertSameOrigin(request);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Entre novamente no painel administrativo.", "AUTH_REQUIRED");
  // app_metadata é administrado no servidor. user_metadata nunca concede acesso.
  if (data.user.app_metadata?.role !== "admin") throw new HttpError(403, "Esta conta não tem permissão de administrador.", "ADMIN_REQUIRED");
  return { supabase, user: data.user };
}
