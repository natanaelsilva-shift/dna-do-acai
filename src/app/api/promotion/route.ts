import { NextResponse } from "next/server";
import { getPromotionWindow } from "@/data/promotion";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ...getPromotionWindow(), serverTime: Date.now() }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
