import { NextResponse } from "next/server";

const BACKEND =
  process.env.AXE_BACKEND_URL || "https://hdr.it.com.ngrok.pro";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BACKEND}/fleet/health/all`, {
      signal: controller.signal,
      // Don't cache — always fresh
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { ts: new Date().toISOString(), summary: { up: 0, total: 0, health: 0 }, services: [], error: `Backend returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    // Backend unreachable — return empty but valid response
    return NextResponse.json({
      ts: new Date().toISOString(),
      summary: { up: 0, total: 0, health: 0 },
      services: [],
      error: "Backend unreachable",
    });
  }
}
