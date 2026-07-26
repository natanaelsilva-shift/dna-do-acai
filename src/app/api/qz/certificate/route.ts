import { NextResponse } from "next/server";

export async function GET() {
  const certificate = process.env.QZ_CERTIFICATE?.replace(/\\n/g, "\n").trim();
  if (!certificate) {
    return NextResponse.json({ error: "Certificado QZ não configurado." }, { status: 404 });
  }

  return new NextResponse(certificate, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
