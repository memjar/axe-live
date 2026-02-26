import { NextResponse } from "next/server";

type ServiceCheck = {
  name: string;
  host: string;
  port: number;
  machine: string;
  endpoint: string;
  category: "ai" | "backend" | "tunnel" | "infra";
};

const SERVICES: ServiceCheck[] = [
  // JL1 - Mac Studio
  { name: "FastAPI (HDRit + AXE)", host: "192.168.1.169", port: 8000, machine: "JL1", endpoint: "/health", category: "backend" },
  { name: "Observer Auth", host: "192.168.1.169", port: 8001, machine: "JL1", endpoint: "/health", category: "backend" },
  { name: "Ollama (JL1)", host: "192.168.1.169", port: 11434, machine: "JL1", endpoint: "/api/tags", category: "ai" },
  { name: "Klaus Chat", host: "192.168.1.169", port: 3000, machine: "JL1", endpoint: "/", category: "backend" },
  { name: "Memory Sync", host: "192.168.1.169", port: 8766, machine: "JL1", endpoint: "/", category: "infra" },
  // JL2 - MacBook Pro
  { name: "Forge Gateway", host: "192.168.1.147", port: 8420, machine: "JL2", endpoint: "/health", category: "backend" },
  { name: "Ollama (JL2)", host: "192.168.1.147", port: 11434, machine: "JL2", endpoint: "/api/tags", category: "ai" },
  // JLa - MacBook Air
  { name: "Chat Centre", host: "192.168.1.148", port: 8081, machine: "JLa", endpoint: "/health", category: "backend" },
  // Tunnels
  { name: "HDRit Tunnel", host: "hdr.it.com.ngrok.pro", port: 443, machine: "ngrok", endpoint: "/health", category: "tunnel" },
  { name: "Observer Tunnel", host: "observer.ngrok.app", port: 443, machine: "ngrok", endpoint: "/health", category: "tunnel" },
];

async function checkService(svc: ServiceCheck): Promise<{
  name: string;
  machine: string;
  category: string;
  status: "up" | "down" | "slow";
  latency: number;
  detail?: string;
}> {
  const start = Date.now();
  const protocol = svc.port === 443 ? "https" : "http";
  const url = svc.port === 443
    ? `${protocol}://${svc.host}${svc.endpoint}`
    : `${protocol}://${svc.host}:${svc.port}${svc.endpoint}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;

    let detail: string | undefined;
    try {
      const data = await res.json();
      if (data.status) detail = data.status;
      if (data.models) detail = `${data.models.length} models`;
    } catch { /* not json */ }

    return {
      name: svc.name,
      machine: svc.machine,
      category: svc.category,
      status: latency > 3000 ? "slow" : "up",
      latency,
      detail,
    };
  } catch {
    return {
      name: svc.name,
      machine: svc.machine,
      category: svc.category,
      status: "down",
      latency: Date.now() - start,
    };
  }
}

export async function GET() {
  const results = await Promise.all(SERVICES.map(checkService));
  const up = results.filter((r) => r.status === "up").length;
  const total = results.length;

  return NextResponse.json({
    ts: new Date().toISOString(),
    summary: { up, total, health: up / total },
    services: results,
  });
}
