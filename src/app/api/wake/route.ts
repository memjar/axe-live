import { NextRequest, NextResponse } from "next/server";

// Machine connection info for diagnostics and wake attempts
const MACHINE_INFO: Record<string, { ip: string; services: { name: string; port: number; endpoint: string; startCmd?: string }[] }> = {
  JL1: {
    ip: "192.168.1.169",
    services: [
      { name: "FastAPI", port: 8000, endpoint: "/health", startCmd: "cd ~/klausimi-backend && uvicorn src.api.main:app --host 0.0.0.0 --port 8000" },
      { name: "Ollama", port: 11434, endpoint: "/api/tags", startCmd: "ollama serve" },
      { name: "Klaus Chat", port: 3000, endpoint: "/", startCmd: "cd ~/Desktop/M1transfer/klaus-chat && npm run dev" },
      { name: "Memory Sync", port: 8766, endpoint: "/", startCmd: "python3 ~/.axe/scripts/memory_sync_ws.py" },
    ],
  },
  JL2: {
    ip: "192.168.1.147",
    services: [
      { name: "Forge Gateway", port: 8420, endpoint: "/health", startCmd: "cd ~/forge-gateway && uvicorn main:app --host 0.0.0.0 --port 8420" },
      { name: "Ollama", port: 11434, endpoint: "/api/tags", startCmd: "ollama serve" },
    ],
  },
  JLa: {
    ip: "192.168.1.148",
    services: [
      { name: "Chat Centre", port: 8081, endpoint: "/health", startCmd: "cd ~/chat-centre && python3 server.py" },
    ],
  },
  JLb: {
    ip: "192.168.1.149",
    services: [],
  },
};

async function probeService(ip: string, port: number, endpoint: string): Promise<{ up: boolean; latency: number; detail?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`http://${ip}:${port}${endpoint}`, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    let detail: string | undefined;
    try {
      const d = await res.json();
      detail = d.status || (d.models ? `${d.models.length} models` : undefined);
    } catch { /* */ }
    return { up: res.ok, latency, detail };
  } catch {
    return { up: false, latency: Date.now() - start };
  }
}

async function pingHost(ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    // Try to reach any port — even a refused connection means the host is up
    await fetch(`http://${ip}:80/`, { signal: controller.signal }).catch((e) => {
      if (e.name === "AbortError") throw e;
      // Connection refused = host is up, just no server on port 80
      return null;
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

// GET — diagnose a machine and its services
export async function GET(req: NextRequest) {
  const machineId = req.nextUrl.searchParams.get("machine");
  if (!machineId || !MACHINE_INFO[machineId]) {
    return NextResponse.json({ error: "Unknown machine" }, { status: 400 });
  }

  const machine = MACHINE_INFO[machineId];
  const hostReachable = await pingHost(machine.ip);

  const serviceResults = await Promise.all(
    machine.services.map(async (svc) => {
      const probe = await probeService(machine.ip, svc.port, svc.endpoint);
      return {
        name: svc.name,
        port: svc.port,
        ...probe,
        startCmd: svc.startCmd,
      };
    })
  );

  const allUp = serviceResults.every((s) => s.up);
  const anyUp = serviceResults.some((s) => s.up);

  // Build diagnostic message
  let diagnosis: string;
  let fixSteps: string[];

  if (!hostReachable && serviceResults.length > 0) {
    diagnosis = `${machineId} is unreachable on the network. The machine may be powered off, sleeping, or disconnected from WiFi.`;
    fixSteps = [
      `Check that ${machineId} (${machine.ip}) is powered on`,
      "Verify it's connected to the same WiFi network",
      "Try waking the machine physically or via Wake-on-LAN",
      "Check System Preferences > Energy Saver to prevent auto-sleep",
    ];
  } else if (!anyUp && serviceResults.length > 0) {
    diagnosis = `${machineId} is on the network but no services are responding. Services may need to be started.`;
    fixSteps = serviceResults.map(
      (s) => `Start ${s.name}: ${s.startCmd || `Check port ${s.port}`}`
    );
    fixSteps.unshift(`SSH into ${machineId}: ssh ${machine.ip}`);
  } else if (!allUp) {
    const down = serviceResults.filter((s) => !s.up);
    diagnosis = `${machineId} is online but ${down.length} service${down.length > 1 ? "s are" : " is"} down.`;
    fixSteps = down.map(
      (s) => `Start ${s.name}: ${s.startCmd || `Check port ${s.port}`}`
    );
    fixSteps.unshift(`SSH into ${machineId}: ssh ${machine.ip}`);
  } else if (serviceResults.length === 0) {
    diagnosis = `${machineId} has no configured services yet.`;
    fixSteps = ["This machine is awaiting deployment"];
  } else {
    diagnosis = `${machineId} is fully operational. All ${serviceResults.length} services responding.`;
    fixSteps = [];
  }

  return NextResponse.json({
    machine: machineId,
    ip: machine.ip,
    hostReachable,
    services: serviceResults,
    allUp,
    diagnosis,
    fixSteps,
  });
}

// POST — attempt to wake/ping a specific service (sends a health check to wake idle connections)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { machine: machineId, service } = body;

  if (!machineId || !MACHINE_INFO[machineId]) {
    return NextResponse.json({ error: "Unknown machine" }, { status: 400 });
  }

  const machine = MACHINE_INFO[machineId];

  if (service) {
    const svc = machine.services.find((s) => s.name === service);
    if (!svc) return NextResponse.json({ error: "Unknown service" }, { status: 400 });
    const probe = await probeService(machine.ip, svc.port, svc.endpoint);
    return NextResponse.json({
      machine: machineId,
      service: svc.name,
      ...probe,
      startCmd: probe.up ? undefined : svc.startCmd,
      message: probe.up ? `${svc.name} is responding` : `${svc.name} is not responding. Start it with: ${svc.startCmd}`,
    });
  }

  // Wake all services on the machine by pinging them
  const results = await Promise.all(
    machine.services.map(async (svc) => {
      const probe = await probeService(machine.ip, svc.port, svc.endpoint);
      return { name: svc.name, ...probe, startCmd: probe.up ? undefined : svc.startCmd };
    })
  );

  return NextResponse.json({
    machine: machineId,
    services: results,
    allUp: results.every((r) => r.up),
  });
}
