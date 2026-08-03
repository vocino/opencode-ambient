import type { Plugin } from "@opencode-ai/plugin";

// Complete mapping of opencode tools + related events to ambient states.
// Exported for testing / extensibility.
export const STATE_MAP: Record<string, string> = {
  // filesystem + edit
  read: "tool",
  write: "building",
  edit: "building",
  patch: "building",
  // execution
  bash: "tool",
  // search
  grep: "tool",
  glob: "tool",
  // network
  webfetch: "tool",
  web_fetch: "tool",
  fetch: "tool",
  // todo / tasks (opencode)
  todowrite: "planning",
  todoread: "planning",
  todo_read: "planning",
  todo_write: "planning",
  task: "planning",
  task_create: "planning",
  task_update: "planning",
  task_list: "tool",
  // questions / waiting
  question: "waiting",
  ask: "waiting",
  ask_user: "waiting",
  // opencode specific
  opencode: "building",
  session: "planning",
  compact: "planning",
  // analysis / plan phases
  plan: "planning",
  analyze: "planning",
  // fix flows
  fix: "fixing",
  fixing: "fixing",
  retry: "fixing",
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
      const normalized = tool?.toLowerCase?.() ?? tool;
      const s = STATE_MAP[normalized] ?? STATE_MAP[tool] ?? "tool";
      void pushState(s, tool);
    },
    "tool.execute.after": async ({ tool }: { tool: string }) => {
      if (tool === "bash" || tool === "write" || tool === "edit" || tool === "patch") {
        void pushState("building", tool);
      }
    },
    event: async ({ event }: { event: { type: string } }) => {
      const t = event?.type ?? "";
      if (t === "session.idle") void pushState("idle");
      else if (t === "session.error") void pushState("error");
      else if (t === "session.created") void pushState("planning");
      else if (t === "session.compacted" || t === "session.compact") void pushState("planning", t);
      else if (t.includes("error") || t.includes("fail")) void pushState("error", t);
      else if (t.includes("done") || t.includes("complete") || t.includes("finish")) void pushState("done", t);
      else if (t.includes("idle") || t.includes("waiting") || t.includes("question") || t.includes("ask")) {
        void pushState("waiting", t);
      }
    },
  };
};
