import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const AGENTS_DIR = join(process.env.HOME || "/Users/home", ".axe/agents");
const LEDGER_PATH = join(
  process.env.HOME || "/Users/home",
  ".axe/memory/coordination/TASK_LEDGER.json"
);
const CHANNEL_PATH = join(
  process.env.HOME || "/Users/home",
  "Desktop/M1transfer/axe-memory/team/channel.jsonl"
);

const AGENT_FILES: Record<string, string> = {
  forge: "forge_system_prompt.md",
  cortana: "cortana_system_prompt.md",
  klaus: "klaus_system_prompt.md",
  axwell: "axwell_system_prompt.md",
  mum: "mum_system_prompt.md",
};

// GET — fetch all agent essences, tasks, and recent channel messages
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "essences") {
    const essences: Record<string, string> = {};
    for (const [name, file] of Object.entries(AGENT_FILES)) {
      try {
        essences[name] = await readFile(join(AGENTS_DIR, file), "utf-8");
      } catch {
        essences[name] = "";
      }
    }
    return NextResponse.json({ essences });
  }

  if (action === "tasks") {
    try {
      const raw = await readFile(LEDGER_PATH, "utf-8");
      const ledger = JSON.parse(raw);
      return NextResponse.json({ tasks: ledger.active_tasks || [], completed: ledger.completed_today || [] });
    } catch {
      return NextResponse.json({ tasks: [], completed: [] });
    }
  }

  if (action === "channel") {
    try {
      const raw = await readFile(CHANNEL_PATH, "utf-8");
      const lines = raw.trim().split("\n").slice(-30);
      const messages = lines
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
      return NextResponse.json({ messages });
    } catch {
      return NextResponse.json({ messages: [] });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// POST — update essence, create task, or post to channel
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;

  // Append to an agent's essence file
  if (action === "update_essence") {
    const { agent, content } = body;
    if (!agent || !content || !AGENT_FILES[agent]) {
      return NextResponse.json({ error: "Invalid agent or content" }, { status: 400 });
    }
    try {
      const filePath = join(AGENTS_DIR, AGENT_FILES[agent]);
      const existing = await readFile(filePath, "utf-8");
      const updated = existing.trimEnd() + "\n\n" + content.trim() + "\n";
      await writeFile(filePath, updated, "utf-8");

      // Post to channel
      const msg = JSON.stringify({
        ts: new Date().toISOString(),
        from: "james",
        to: agent,
        type: "essence_update",
        msg: `Updated ${agent}'s essence: ${content.slice(0, 100)}...`,
      });
      await writeFile(CHANNEL_PATH, (await readFile(CHANNEL_PATH, "utf-8")) + msg + "\n", "utf-8");

      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Create a new task assigned to an agent
  if (action === "create_task") {
    const { agent, title, priority, notes } = body;
    if (!agent || !title) {
      return NextResponse.json({ error: "Missing agent or title" }, { status: 400 });
    }
    try {
      const raw = await readFile(LEDGER_PATH, "utf-8");
      const ledger = JSON.parse(raw);
      const id = `LIVE-${String(Date.now()).slice(-6)}`;
      const task = {
        id,
        title,
        assigned_to: agent,
        status: "pending",
        priority: priority || "MEDIUM",
        notes: notes || "",
        created_at: new Date().toISOString(),
        created_from: "axe-live",
      };
      ledger.active_tasks.push(task);
      ledger.last_updated = new Date().toISOString();
      await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf-8");

      // Notify via channel
      const msg = JSON.stringify({
        ts: new Date().toISOString(),
        from: "james",
        to: agent,
        type: "task_assigned",
        msg: `New task for ${agent}: ${title} [${priority || "MEDIUM"}]`,
      });
      await writeFile(CHANNEL_PATH, (await readFile(CHANNEL_PATH, "utf-8")) + msg + "\n", "utf-8");

      return NextResponse.json({ success: true, task });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Post a message to team channel
  if (action === "send_message") {
    const { to, message } = body;
    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }
    try {
      const msg = JSON.stringify({
        ts: new Date().toISOString(),
        from: "james",
        to: to || "team",
        type: "message",
        msg: message,
      });
      await writeFile(CHANNEL_PATH, (await readFile(CHANNEL_PATH, "utf-8")) + msg + "\n", "utf-8");
      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
