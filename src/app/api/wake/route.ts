import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.AXE_BACKEND_URL || "https://hdr.it.com.ngrok.pro";

export async function GET(req: NextRequest) {
  const machineId = req.nextUrl.searchParams.get("machine");
  if (!machineId) {
    return NextResponse.json({ error: "Missing machine param" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${BACKEND}/fleet/wake/${machineId}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({
      machine: machineId,
      ip: "unknown",
      hostReachable: false,
      services: [],
      allUp: false,
      diagnosis: "Backend unreachable — cannot diagnose machine.",
      fixSteps: ["Check that the FastAPI backend is running on JL1", "Verify ngrok tunnel is active"],
    });
  }
}
