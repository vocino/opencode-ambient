import type { Plugin } from "@opencode-ai/plugin";

const STATE_MAP: Record<string, string> = {
  read: "tool",
  write: "building",
  edit: "building",
  bash: "tool",
  grep: "tool",
  glob: "tool",
  webfetch: "tool",
  todowrite: "planning",
};

let daemonUrl = "http://127.0.0.1:7686";

async function pushState(state: string, extra?: string) {
  try {
    await fetch(`${daemonUrl}/glow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, extra }),
      signal: AbortSignal.timeout(800),
    });
  } catch {}
}

export const server: Plugin = async (_input, opts: any) => {
  if (opts?.port) daemonUrl = `http://127.0.0.1:${opts.port}`;
  if (opts?.daemonUrl) daemonUrl = opts.daemonUrl;

  return {
    "tool.execute.before": async ({ tool }: { tool: string }) => {
      const s = STATE_MAP[tool] ?? "tool";
      void pushState(s, tool);
    },
    "tool.execute.after": async ({ tool }: { tool: string }) => {
      if (tool === "bash" || tool === "write" || tool === "edit") {
        void pushState("building", tool);
      }
    },
    event: async ({ event }: { event: { type: string } }) => {
      if (event.type === "session.idle") void pushState("idle");
      if (event.type === "session.error") void pushState("error");
      if (event.type === "session.created") void pushState("planning");
    },
  };
};
