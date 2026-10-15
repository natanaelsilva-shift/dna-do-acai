import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { apiError, HttpError, noStore } from "@/lib/server/http";

export async function GET() {
  try {
    await requireAdmin();
    const certificate = process.env.QZ_CERTIFICATE?.replace(/\\n/g, "\n").trim();
    if (!certificate) throw new HttpError(503, "Certificado QZ não configurado.");
    return new NextResponse(certificate, { headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) { return apiError(error, "qz-certificate", "Não foi possível carregar o certificado QZ."); }
}
