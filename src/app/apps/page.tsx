"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthGate from "../auth-gate";

type ServiceResult = {
  name: string;
  machine: string;
  category: string;
  status: "up" | "down" | "slow";
  latency: number;
  detail?: string;
};

type HealthData = {
  ts: string;
  summary: { up: number; total: number; health: number };
  services: ServiceResult[];
};

const MACHINE_META: Record<string, { label: string; desc: string; icon: string }> = {
  JL1: { label: "JL1 — Mac Studio", desc: "M1 Max 64GB · Primary Node", icon: "◆" },
  JL2: { label: "JL2 — MacBook Pro", desc: "M1 Pro 16GB · Forge Node", icon: "◇" },
  JLa: { label: "JLa — MacBook Air", desc: "Intel 2015 · Mum Node", icon: "○" },
  JLb: { label: "JLb — MacBook Pro", desc: "Intel 2012 · Reaper Drone", icon: "◁" },
  ngrok: { label: "Tunnels", desc: "ngrok Edge Network", icon: "⬡" },
};

export default function AppsPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const d = await res.json();
      setData(d);
      setLastCheck(new Date().toLocaleTimeString());
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Group by machine
  const grouped = data?.services.reduce<Record<string, ServiceResult[]>>((acc, svc) => {
    (acc[svc.machine] = acc[svc.machine] || []).push(svc);
    return acc;
  }, {}) || {};

  const healthPct = data ? Math.round(data.summary.health * 100) : 0;

  return (
    <AuthGate>
      <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
        {/* Health bar at top */}
        <div
          className="progress-bar"
          style={{ transform: `scaleX(${data ? data.summary.health : 0})` }}
        />

        {/* Header */}
        <header
          className="glass flex items-center gap-4 px-6 py-4"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--green)", letterSpacing: "0.05em", lineHeight: 1 }}>
              AXE LIVE
            </h1>
          </Link>

          <nav className="flex items-center gap-4">
            <Link href="/" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
              Dashboard
            </Link>
            <Link href="/apps" className="eyebrow" style={{ color: "var(--green)", textDecoration: "none" }}>
              Apps
            </Link>
            <Link href="/live" className="eyebrow" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
              Live Feeds
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
              {lastCheck && `Checked ${lastCheck}`}
            </span>
            <button
              onClick={refresh}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                background: "transparent",
                color: "var(--green)",
                border: "1px solid var(--rule)",
                borderRadius: "4px",
                padding: "8px 16px",
                minHeight: "36px",
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="eyebrow pulse-green">Scanning infrastructure...</span>
            </div>
          ) : (
            <>
              {/* Overall health ring */}
              <div className="flex items-center gap-8 mb-8">
                <div className="relative" style={{ width: 96, height: 96 }}>
                  <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--rule)" strokeWidth="4" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="var(--green)" strokeWidth="4"
                      strokeDasharray={`${healthPct * 2.64} 264`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 500ms ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--foreground)" }}>
                      {healthPct}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "32px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                    SYSTEM HEALTH
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="eyebrow">{data?.summary.up}/{data?.summary.total} Online</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                      4 Machines · {data?.services.length} Services
                    </span>
                  </div>
                </div>
              </div>

              {/* Machine groups */}
              <div className="flex flex-col gap-6">
                {Object.entries(MACHINE_META).map(([key, meta]) => {
                  const services = grouped[key];
                  const allUp = services?.every((s) => s.status === "up");
                  const anyDown = services?.some((s) => s.status === "down");

                  return (
                    <div key={key} className="glass card-hover rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
                      {/* Machine header */}
                      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--rule)" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--green)" }}>
                          {meta.icon}
                        </span>
                        <div>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--foreground)", letterSpacing: "0.03em" }}>
                            {meta.label}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", display: "block", marginTop: 2 }}>
                            {meta.desc}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background: !services ? "var(--text-tertiary)" : allUp ? "var(--green)" : anyDown ? "#ff4444" : "#ffaa00",
                              ...(allUp ? {} : {}),
                            }}
                          />
                          <span className="eyebrow" style={{ color: !services ? "var(--text-tertiary)" : allUp ? "var(--green)" : anyDown ? "#ff4444" : "#ffaa00" }}>
                            {!services ? "No services" : allUp ? "All systems go" : anyDown ? "Degraded" : "Slow"}
                          </span>
                        </div>
                      </div>

                      {/* Services grid */}
                      {services ? (
                        <div className="grid gap-px" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", background: "var(--rule)" }}>
                          {services.map((svc) => (
                            <div
                              key={svc.name}
                              className="px-5 py-4"
                              style={{ background: "var(--card)" }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${svc.status === "up" ? "pulse-green" : ""}`}
                                  style={{ background: svc.status === "up" ? "var(--green)" : svc.status === "slow" ? "#ffaa00" : "#ff4444" }}
                                />
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 500, color: "var(--foreground)" }}>
                                  {svc.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="eyebrow" style={{ color: svc.status === "up" ? "var(--green)" : "#ff4444" }}>
                                  {svc.status}
                                </span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                                  {svc.latency}ms
                                </span>
                                {svc.detail && (
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>
                                    {svc.detail}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-6 py-4">
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                            {key === "JLb" ? "Awaiting deployment — SSH configuration pending" : "No services registered"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGate>
  );
}
