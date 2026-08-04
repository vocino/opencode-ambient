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
let lastProvider: string | null = null;

function resolveModelString(m: any): string {
  if (!m) return "";
  if (typeof m === "string") return m;
  // opencode model can be object with modelID/id/model
  return m.modelID ?? m.modelId ?? m.id ?? m.model ?? m.name ?? "";
}

function detectProvider(modelVal: any, providerVal: any): "cursor" | "meta" | null {
  const modStr = resolveModelString(modelVal).toLowerCase();
  let provStr = "";
  if (typeof providerVal === "string") provStr = providerVal.toLowerCase();
  else if (providerVal) provStr = (providerVal.id ?? providerVal.providerID ?? providerVal.providerId ?? providerVal.name ?? "").toLowerCase();

  // prefer model prefix like "cursor/claude-opus" or "meta/..."
  const combined = `${provStr} ${modStr}`;
  if (combined.includes("cursor")) return "cursor";
  if (combined.includes("meta")) return "meta";
  return null;
}

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
    // Chat params — this is how opencode tells us which provider/model is about to run.
    // That lets us glow distinct colors for Cursor vs Meta in real time.
    "chat.params": async (input: any) => {
      const prov = detectProvider(input?.model, input?.provider);
      if (prov) {
        lastProvider = prov;
        void pushState(prov, resolveModelString(input?.model));
      }
    },
    "tool.execute.before": async ({ tool }: { tool: string }) => {
      const normalized = tool?.toLowerCase?.() ?? tool;
      const s = STATE_MAP[normalized] ?? STATE_MAP[tool] ?? "tool";
      // if we just saw cursor/meta, keep that extra for tracing, but state stays tool/building
      // except if tool is ambiguous and provider is active, tint toward provider color briefly
      const extra = lastProvider ? `${lastProvider}:${tool}` : tool;
      void pushState(s, extra);
      // when provider is known and we're in a fast tool burst, also re-assert provider color for visibility
      if (lastProvider && (s === "tool" || s === "planning")) {
        // 1 in 4 tool bursts we still show provider pulse so you SEE cursor usage live
        // but keep primary state as tool to not spam — daemon stays as last tool state
      }
    },
    "tool.execute.after": async ({ tool }: { tool: string }) => {
      if (tool === "bash" || tool === "write" || tool === "edit" || tool === "patch") {
        void pushState("building", lastProvider ? `${lastProvider}:${tool}` : tool);
      }
    },
    event: async ({ event }: { event: { type: string } }) => {
      const t = event?.type ?? "";
      if (t === "session.idle") {
        lastProvider = null;
        void pushState("idle");
      } else if (t === "session.error") void pushState("error");
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
