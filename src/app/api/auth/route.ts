import { NextRequest, NextResponse } from "next/server";

const OBSERVER_URL =
  process.env.OBSERVER_URL || "https://observer.ngrok.app";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "vkey";
const SESSION_COOKIE = "axe_session";
const SESSION_TTL = 60 * 60 * 24; // 24 hours

// In-memory session store (survives within the serverless function lifetime)
// For Vercel, this is per-instance, but combined with the cookie check it works fine.
const validSessions = new Map<string, number>();

function generateSession(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanSessions() {
  const now = Date.now();
  for (const [id, exp] of validSessions) {
    if (exp < now) validSessions.delete(id);
  }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  // Check if already authenticated
  if (action === "check") {
    const cookie = req.cookies.get(SESSION_COOKIE);
    if (cookie) {
      const exp = validSessions.get(cookie.value);
      if (exp && exp > Date.now()) {
        return NextResponse.json({ authenticated: true });
      }
    }
    return NextResponse.json({ authenticated: false });
  }

  // Poll observer auth session
  if (action === "poll") {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }
    try {
      const res = await fetch(`${OBSERVER_URL}/auth/check/${sessionId}`);
      const data = await res.json();

      if (data.status === "approved") {
        // Create local session
        cleanSessions();
        const token = generateSession();
        validSessions.set(token, Date.now() + SESSION_TTL * 1000);

        const response = NextResponse.json({ status: "approved" });
        response.cookies.set(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: SESSION_TTL,
          path: "/",
        });
        return response;
      }

      return NextResponse.json({ status: data.status });
    } catch {
      return NextResponse.json({ status: "error" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;

  // Password auth
  if (action === "password") {
    if (body.password === AUTH_PASSWORD) {
      cleanSessions();
      const token = generateSession();
      validSessions.set(token, Date.now() + SESSION_TTL * 1000);

      const response = NextResponse.json({ authenticated: true });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: SESSION_TTL,
        path: "/",
      });
      return response;
    }
    return NextResponse.json({ authenticated: false, error: "Invalid password" });
  }

  // Start observer auth session (Unlock button)
  if (action === "unlock") {
    try {
      const res = await fetch(`${OBSERVER_URL}/auth/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: "axe-live",
          email: "james@axe.observer",
          ip: req.headers.get("x-forwarded-for") || "unknown",
        }),
      });
      const data = await res.json();
      return NextResponse.json({
        session_id: data.session_id,
        code: data.code,
        expires_in: data.expires_in,
      });
    } catch {
      return NextResponse.json({ error: "Observer unreachable" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
