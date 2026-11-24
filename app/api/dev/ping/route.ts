import { NextResponse } from "next/server";
import { runPing } from "@/lib/dev/ping";

// TEMPORARY (Stage 1): lets you curl the ping and see real status codes, such as
// 429 when the daily cap is hit. Removed in Stage 7; blocked in production.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  try {
    const { status, body } = await runPing(req, url.searchParams.get("agency") ?? "VITA", url.searchParams.get("useCase") ?? "policy-qa");
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "ping failed" }, { status: 500 });
  }
}
