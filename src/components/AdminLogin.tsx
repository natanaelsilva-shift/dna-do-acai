"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AdminLogin() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")).trim(), password: String(form.get("password")) });
      if (error) { setMessage(error.status === 400 ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente novamente em instantes."); return; }
      if (data.user?.app_metadata?.role !== "admin") {
        await supabase.auth.signOut({ scope: "local" });
        setMessage("Esta conta não tem permissão de administrador."); return;
      }
      window.location.replace("/admin/pedidos");
    } catch { setMessage("O acesso ao painel está temporariamente indisponível. Tente novamente em instantes."); }
    finally { setPending(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#0b3425] px-5 py-12 text-[#16221a]">
    <form onSubmit={login} className="w-full max-w-sm space-y-5 rounded-3xl bg-[#f5f6f3] p-7 shadow-xl">
      <div><p className="text-sm font-bold text-[#14743f]">DNA DO AÇAÍ</p><h1 className="mt-2 text-2xl font-bold">Entrar no painel</h1><p className="mt-2 text-sm">Use sua conta administrativa.</p></div>
      <label className="block text-sm font-semibold">E-mail<input name="email" type="email" autoComplete="username" required maxLength={254} className="mt-2 w-full rounded-xl border border-black/20 bg-white p-3" /></label>
      <label className="block text-sm font-semibold">Senha<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-black/20 bg-white p-3" /></label>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-[#14743f] p-3 font-bold text-white disabled:opacity-60">{pending ? "Entrando…" : "Entrar"}</button>
      <Link href="/" className="block text-center text-sm underline">Voltar à loja</Link>
    </form>
  </main>;
}
