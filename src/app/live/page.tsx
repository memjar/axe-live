"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import AuthGate from "../auth-gate";

type FeedEvent = {
  machine: string;
  agent?: string;
  model?: string;
  type: string;
  content: string;
  ts: string;
};

type MachineConfig = {
  id: string;
  label: string;
  name: string;
  desc: string;
  icon: string;
  agents: string[];
  endpoints: { ws?: string; http?: string };
};

const MACHINES: MachineConfig[] = [
  {
    id: "JL1",
    label: "JL1 — Mac Studio",
    name: "Cortana",
    desc: "M1 Max 64GB · Primary Node",
    icon: "◆",
    agents: ["Cortana", "Klaus", "Axwell", "Critic"],
    endpoints: {
      http: "http://192.168.1.169:8000",
    },
  },
  {
    id: "JL2",
    label: "JL2 — MacBook Pro",
    name: "Forge",
    desc: "M1 Pro 16GB · Forge Node",
    icon: "◇",
    agents: ["Forge"],
    endpoints: {
      http: "http://192.168.1.147:8420",
    },
  },
  {
    id: "JLa",
    label: "JLa — MacBook Air",
    name: "Mum",
    desc: "Intel 2015 · Chat Centre + Critic",
    icon: "○",
    agents: ["Mum", "Chat Centre", "Critic"],
    endpoints: {
      ws: "ws://192.168.1.148:8081/ws/live",
      http: "http://192.168.1.148:8081",
    },
  },
  {
    id: "JLb",
    label: "JLb — MacBook Pro 2012",
    name: "Reaper",
    desc: "Intel 2012 · Reaper Drone",
    icon: "◁",
    agents: [],
    endpoints: {},
  },
];

export default function LiveFeedsPage() {
  const [feeds, setFeeds] = useState<Record<string, FeedEvent[]>>({
    JL1: [], JL2: [], JLa: [], JLb: [],
  });
  const [connected, setConnected] = useState<Record<string, boolean>>({
    JL1: false, JL2: false, JLa: false, JLb: false,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const feedRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Connect to Chat Centre WebSocket (JLa) for real-time events
  useEffect(() => {
    const jla = MACHINES.find((m) => m.id === "JLa");
    if (!jla?.endpoints.ws) return;

    let ws: WebSocket;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(jla!.endpoints.ws!);
      ws.onopen = () => setConnected((p) => ({ ...p, JLa: true }));
      ws.onclose = () => {
        setConnected((p) => ({ ...p, JLa: false }));
        timer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const event: FeedEvent = {
            machine: "JLa",
            agent: data.agent || "System",
            model: data.engine,
            type: data.type || "event",
            content: data.content || JSON.stringify(data).slice(0, 200),
            ts: data.ts || new Date().toISOString(),
          };
          setFeeds((p) => ({
            ...p,
            JLa: [...p.JLa.slice(-99), event],
          }));
        } catch { /* */ }
      };
    }

    connect();
    return () => {
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  // Poll other machines for recent activity
  const pollMachine = useCallback(async (machine: MachineConfig) => {
    if (!machine.endpoints.http) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Try /events/recent or /health
      let url = `${machine.endpoints.http}/events/recent?limit=10`;
      let res = await fetch(url, { signal: controller.signal }).catch(() => null);

      if (!res || !res.ok) {
        url = `${machine.endpoints.http}/health`;
        res = await fetch(url, { signal: controller.signal }).catch(() => null);
      }

      clearTimeout(timeout);

      if (res && res.ok) {
        setConnected((p) => ({ ...p, [machine.id]: true }));
        const data = await res.json();

        if (data.events) {
          const events: FeedEvent[] = data.events.map((ev: Record<string, string>) => ({
            machine: machine.id,
            agent: ev.agent || "System",
            model: ev.engine,
            type: ev.type || "event",
            content: ev.content || "",
            ts: ev.ts || new Date().toISOString(),
          }));
          setFeeds((p) => ({ ...p, [machine.id]: events }));
        } else {
          // Health response — show as heartbeat
          const event: FeedEvent = {
            machine: machine.id,
            type: "heartbeat",
            content: data.status || "online",
            ts: new Date().toISOString(),
          };
          setFeeds((p) => ({
            ...p,
            [machine.id]: [...p[machine.id].slice(-99), event],
          }));
        }
      } else {
        setConnected((p) => ({ ...p, [machine.id]: false }));
      }
    } catch {
      setConnected((p) => ({ ...p, [machine.id]: false }));
    }
  }, []);

  useEffect(() => {
    const nonWsMachines = MACHINES.filter((m) => m.id !== "JLa" && m.endpoints.http);
    nonWsMachines.forEach(pollMachine);
    const interval = setInterval(() => nonWsMachines.forEach(pollMachine), 10000);
    return () => clearInterval(interval);
  }, [pollMachine]);

  // Auto-scroll each feed
  useEffect(() => {
    Object.entries(feedRefs.current).forEach(([id, el]) => {
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [feeds]);

  const totalEvents = Object.values(feeds).reduce((sum, f) => sum + f.length, 0);
  const onlineCount = Object.values(connected).filter(Boolean).length;

  return (
    <AuthGate>
      <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
        <div className="progress-bar" style={{ transform: `scaleX(${onlineCount / MACHINES.length})` }} />

        {/* Header */}
        <header className="glass flex items-center gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--green)", letterSpacing: "0.05em", lineHeight: 1 }}>
              AXE LIVE
            </h1>
          </Link>

          <nav className="flex items-center gap-4">
            <Link href="/" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
              Dashboard
            </Link>
            <Link href="/apps" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
              Apps
            </Link>
            <Link href="/live" className="eyebrow" style={{ color: "var(--green)", textDecoration: "none" }}>
              Live Feeds
            </Link>
            <Link href="/team" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
              Team
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="eyebrow">{onlineCount}/{MACHINES.length} Online</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
              {totalEvents} events
            </span>
          </div>
        </header>

        {/* Feed grid */}
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{
            display: "grid",
            gridTemplateColumns: expanded ? "1fr" : "repeat(2, 1fr)",
            gap: "16px",
            alignContent: "start",
          }}
        >
          {MACHINES.map((machine) => {
            if (expanded && expanded !== machine.id) return null;
            const machineFeed = feeds[machine.id] || [];
            const isConnected = connected[machine.id];

            return (
              <div
                key={machine.id}
                className="glass card-hover rounded-lg overflow-hidden flex flex-col"
                style={{
                  border: "1px solid var(--rule)",
                  height: expanded ? "calc(100vh - 160px)" : "calc(50vh - 80px)",
                  minHeight: 200,
                }}
              >
                {/* Machine header */}
                <div
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                  style={{ borderBottom: "1px solid var(--rule)" }}
                  onClick={() => setExpanded(expanded === machine.id ? null : machine.id)}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--green)" }}>
                    {machine.icon}
                  </span>
                  <div className="flex-1">
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                      {machine.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block" }}>
                      {machine.name} · {machine.desc}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${isConnected ? "pulse-green" : ""}`}
                      style={{ background: isConnected ? "var(--green)" : machine.id === "JLb" ? "var(--text-tertiary)" : "#ff4444" }}
                    />
                    <span className="eyebrow" style={{ color: isConnected ? "var(--green)" : "var(--text-tertiary)" }}>
                      {isConnected ? "Live" : machine.id === "JLb" ? "Standby" : "Offline"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", marginLeft: 8 }}>
                      {expanded === machine.id ? "▼" : "▶"}
                    </span>
                  </div>
                </div>

                {/* Agent status boxes */}
                {machine.agents.length > 0 && (
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {machine.agents.map((a) => {
                        const lastEvent = [...machineFeed].reverse().find((ev) => ev.agent?.toLowerCase() === a.toLowerCase());
                        const isActive = lastEvent && (Date.now() - new Date(lastEvent.ts).getTime()) < 120000;
                        const summary = lastEvent
                          ? lastEvent.type === "heartbeat"
                            ? "Standing by"
                            : lastEvent.content.length > 80
                              ? lastEvent.content.slice(0, 77) + "..."
                              : lastEvent.content
                          : "No recent activity";

                        return (
                          <div
                            key={a}
                            style={{
                              flex: "1 1 0",
                              minWidth: 120,
                              background: "var(--background)",
                              border: `1px solid ${isActive ? "var(--green)" : "var(--rule)"}`,
                              borderRadius: "6px",
                              padding: "8px 10px",
                              transition: "border-color 150ms",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                              <span
                                className={isActive ? "pulse-green" : ""}
                                style={{
                                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                  background: isActive ? "var(--green)" : "var(--text-tertiary)",
                                }}
                              />
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: isActive ? "var(--green)" : "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {a}
                              </span>
                              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)" }}>
                                {isActive ? "Active" : "Idle"}
                              </span>
                            </div>
                            <p style={{
                              fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-tertiary)",
                              lineHeight: 1.4, margin: 0,
                              overflow: "hidden", textOverflow: "ellipsis",
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                            }}>
                              {summary}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Feed */}
                <div
                  ref={(el) => { feedRefs.current[machine.id] = el; }}
                  className="flex-1 overflow-y-auto px-5 py-3"
                  style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                >
                  {machineFeed.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.22em" }}>
                        {machine.id === "JLb" ? "Awaiting deployment" : isConnected ? "Listening..." : "No signal"}
                      </span>
                    </div>
                  ) : (
                    machineFeed.map((ev, i) => (
                      <div
                        key={i}
                        className={i >= machineFeed.length - 3 ? "animate-fade-in" : ""}
                        style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", flexShrink: 0, marginTop: 2, width: 56 }}>
                          {new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        {ev.agent && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500, color: "var(--green)", flexShrink: 0, marginTop: 2, width: 56 }}>
                            {ev.agent.slice(0, 8)}
                          </span>
                        )}
                        <span style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "13px",
                          color: ev.type === "heartbeat" ? "var(--text-tertiary)" : "var(--foreground)",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: expanded ? 10 : 2,
                          WebkitBoxOrient: "vertical",
                        }}>
                          {ev.content}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AuthGate>
  );
}
