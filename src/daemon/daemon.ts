import { createServer, type Server } from "http";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import type { AmbientConfig, GlowRequest, AgentState } from "../types.js";
import { loadConfig, PID_PATH, ensureConfigDir, validateConfig } from "../config/config.js";
import { glow } from "../ambient/index.js";

export const VALID_STATES = new Set<AgentState>([
  "idle",
  "planning",
  "building",
  "tool",
  "fixing",
  "waiting",
  "done",
  "error",
  "cursor",
  "meta",
]);

export const MAX_BODY_BYTES = 10 * 1024; // 10kb

let server: Server | null = null;
let activeConfig: AmbientConfig | null = null;
let lastState: AgentState = "idle";
let idleTimer: NodeJS.Timeout | null = null;

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonRunning(): boolean {
  if (!existsSync(PID_PATH)) return false;
  try {
    const raw = readFileSync(PID_PATH, "utf-8").trim();
    const pid = parseInt(raw, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      // stale/corrupt pid file
      try {
        unlinkSync(PID_PATH);
      } catch {}
      return false;
    }
    if (!isPidRunning(pid)) {
      try {
        unlinkSync(PID_PATH);
      } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function readPid(): number | null {
  if (!existsSync(PID_PATH)) return null;
  try {
    const v = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export async function handleGlow(req: GlowRequest, cfg: AmbientConfig): Promise<void> {
  const state = req?.state as AgentState;
  if (!state || !VALID_STATES.has(state)) return;
  lastState = state;
  await glow(cfg, state);

  if (idleTimer) clearTimeout(idleTimer);
  if (state !== "idle") {
    idleTimer = setTimeout(async () => {
      try {
        await glow(cfg, "idle");
        lastState = "idle";
      } catch {}
    }, cfg.daemon.idleReturnMs);
  }
}

export function getLastState(): AgentState {
  return lastState;
}

export function resetForTests(): void {
  lastState = "idle";
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export async function startDaemon(): Promise<void> {
  if (isDaemonRunning()) throw new Error(`Daemon already running pid ${readPid()}`);

  ensureConfigDir();
  const cfg = loadConfig();
  const cfgErrors = validateConfig(cfg);
  if (cfgErrors.length) throw new Error(`Invalid config: ${cfgErrors.join("; ")}`);
  activeConfig = cfg;

  server = createServer(async (req: any, res: any) => {
    if (req.method === "POST" && req.url === "/glow") {
      let body = "";
      let bytes = 0;
      let tooLarge = false;

      req.on("data", (chunk: any) => {
        bytes += chunk?.length ?? 0;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          // stop accumulating but keep draining
          return;
        }
        body += chunk;
      });

      req.on("end", async () => {
        if (tooLarge) {
          res.writeHead(413, { "Content-Type": "text/plain" }).end("payload too large");
          return;
        }
        try {
          const data = JSON.parse(body) as GlowRequest;
          await handleGlow(data, activeConfig!);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, state: data.state }));
        } catch (e: any) {
          const msg = e?.message ?? "bad request";
          const isJson = msg.includes("JSON") || msg.includes("Unexpected");
          res.writeHead(isJson ? 400 : 400).end(msg);
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          state: lastState,
          hue: activeConfig?.hue.enabled ?? false,
          govee: activeConfig?.govee.enabled ?? false,
        }),
      );
      return;
    }

    res.writeHead(404).end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: any) => {
      if (err?.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${activeConfig!.daemon.port} already in use — is another daemon running? (pid ${readPid() ?? "unknown"})`,
          ),
        );
      } else {
        reject(err);
      }
    };
    server!.once("error", onError);
    server!.listen(activeConfig!.daemon.port, "127.0.0.1", () => {
      server!.off("error", onError);
      resolve();
    });
  });

  writeFileSync(PID_PATH, String(process.pid));
  console.log(`opencode-ambient daemon pid ${process.pid} port ${activeConfig.daemon.port} state idle`);
  await glow(activeConfig, "idle");

  process.on("SIGINT", async () => {
    await stopDaemon();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await stopDaemon();
    process.exit(0);
  });
}

export async function stopDaemon(): Promise<void> {
  if (server) {
    await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  }
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (existsSync(PID_PATH)) {
    try {
      unlinkSync(PID_PATH);
    } catch {}
  }
  try {
    if (activeConfig) await glow(activeConfig, "idle");
  } catch {}
}
