import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const { url, key } = getPublicSupabaseConfig();
    const supabase = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    await supabase.auth.getUser();
  } catch {
    // O login permanece disponível; páginas e APIs validam o acesso.
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = { matcher: ["/admin/:path*", "/api/orders/:path*", "/api/store-status", "/api/printing/:path*", "/api/qz/:path*", "/api/catalog"] };
