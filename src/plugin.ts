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

// Token-tank: immersive pressure tracking (0..1 = full room -> drained)
// We keep a running estimate since opencode doesn't always expose exact counts on every hook.
// When real usage arrives via message.updated with prompt/completion tokens, we snap to it.

let estimatedTokens = 0;
let maxTokens = 128_000; // default, overridden by model detection
let pressureOverride: number | null = null; // when real usage known
let lastFixAt = 0;
let fixStreak = 0;

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

function inferMaxTokens(modelStr: string, provider: string | null): number {
  const s = `${provider ?? ""} ${modelStr}`.toLowerCase();
  if (s.includes("1m") || s.includes("1000000") || s.includes("1000k") || s.includes("spark") || s.includes("meta")) return 1_000_000;
  if (s.includes("200k") || s.includes("200000") || s.includes("sonnet") || s.includes("opus") || s.includes("claude") || s.includes("cursor")) return 200_000;
  if (s.includes("128k") || s.includes("gpt-4")) return 128_000;
  if (s.includes("32k")) return 32_000;
  return 128_000;
}

function currentPressure(): number {
  if (pressureOverride !== null) return Math.max(0, Math.min(1, pressureOverride));
  const p = estimatedTokens / Math.max(1, maxTokens);
  return Math.max(0, Math.min(1, p));
}

function bumpTokens(n: number) {
  estimatedTokens += n;
  if (estimatedTokens > maxTokens * 1.1) estimatedTokens = maxTokens * 1.1; // cap a bit over for full red
}

function tryExtractUsage(eventAny: any): number | null {
  // try many shapes opencode might send: properties.usage, message.usage, delta.usage, data.usage
  const candidates = [
    eventAny?.usage,
    eventAny?.properties?.usage,
    eventAny?.properties?.message?.usage,
    eventAny?.message?.usage,
    eventAny?.part?.usage,
    eventAny?.properties?.part?.usage,
    eventAny?.data?.usage,
    eventAny?.delta?.usage,
  ];
  for (const u of candidates) {
    if (!u) continue;
    // shapes: { prompt_tokens+completion, total_tokens, input_tokens+output }
    const total = u.total_tokens ?? u.totalTokens ?? (u.prompt_tokens && u.completion_tokens ? u.prompt_tokens + u.completion_tokens : null) ?? (u.input_tokens && u.output_tokens ? u.input_tokens + u.output_tokens : null);
    if (typeof total === "number" && total > 0) return total;
    if (typeof u.tokens === "number") return u.tokens;
  }
  // also check prompt/completion separated
  const pt = eventAny?.properties?.message?.tokens ?? eventAny?.tokens ?? null;
  if (typeof pt === "number") return pt;
  return null;
}

function trackFix(state: string) {
  const now = Date.now();
  if (state === "fixing" || state === "error") {
    if (now - lastFixAt < 45_000) {
      fixStreak += 1;
    } else {
      fixStreak = 1;
    }
    lastFixAt = now;
  } else if (state === "idle" || state === "done") {
    // decay streak after success/idle
    if (now - lastFixAt > 20_000) fixStreak = Math.max(0, fixStreak - 1);
  }
  if (fixStreak > 8) fixStreak = 8;
}

async function pushState(state: string, extra?: string, opts?: { pressure?: number; fixStreak?: number; tokensUsed?: number; tokensMax?: number }) {
  try {
    const p = opts?.pressure ?? currentPressure();
    const body: any = {
      state,
      extra,
      pressure: p,
      usagePercent: Math.round(p * 100),
      fixStreak: opts?.fixStreak ?? fixStreak,
    };
    if (typeof opts?.tokensUsed === "number") body.tokensUsed = opts.tokensUsed;
    else if (estimatedTokens > 0) body.tokensUsed = Math.round(estimatedTokens);
    if (typeof opts?.tokensMax === "number") body.tokensMax = opts.tokensMax;
    else if (maxTokens) body.tokensMax = maxTokens;

    await fetch(`${daemonUrl}/glow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(800),
    });
  } catch {}
}

export const server: Plugin = async (_input, opts: any) => {
  if (opts?.port) daemonUrl = `http://127.0.0.1:${opts.port}`;
  if (opts?.daemonUrl) daemonUrl = opts.daemonUrl;

  return {
    // Chat params — this is how opencode tells us which provider/model is about to run.
    // That lets us glow distinct colors for Cursor vs Meta in real time, and infer context limits for token tank.
    "chat.params": async (input: any) => {
      const modelStr = resolveModelString(input?.model);
      const prov = detectProvider(input?.model, input?.provider);
      maxTokens = inferMaxTokens(modelStr, prov);
      if (prov) {
        lastProvider = prov;
        trackFix(prov);
        void pushState(prov, modelStr, { tokensMax: maxTokens });
      } else {
        // still bump slightly for thinking
        bumpTokens(120);
      }
    },
    "chat.message": async (input: any) => {
      // Estimate tokens from message content (chars / 4 rough)
      try {
        const msg = input?.message;
        const parts = input?.parts ?? msg?.parts ?? [];
        let chars = 0;
        if (typeof msg?.content === "string") chars += msg.content.length;
        for (const p of parts) {
          if (typeof p?.text === "string") chars += p.text.length;
          if (typeof p?.content === "string") chars += p.content.length;
        }
        if (chars > 0) bumpTokens(Math.max(50, Math.round(chars / 3.5)));
      } catch {}
    },
    "tool.execute.before": async ({ tool }: { tool: string }) => {
      const normalized = tool?.toLowerCase?.() ?? tool;
      const s = STATE_MAP[normalized] ?? STATE_MAP[tool] ?? "tool";
      bumpTokens(s === "building" ? 700 : s === "tool" ? 350 : 200);
      trackFix(s);
      const extra = lastProvider ? `${lastProvider}:${tool}` : tool;
      void pushState(s, extra);
    },
    "tool.execute.after": async ({ tool, output }: { tool: string; output?: any }) => {
      // Small token bump from tool output length
      try {
        const outStr = typeof output === "string" ? output : output?.content ?? "";
        if (typeof outStr === "string" && outStr.length > 200) bumpTokens(Math.min(1500, Math.round(outStr.length / 6)));
      } catch {}
      if (tool === "bash" || tool === "write" || tool === "edit" || tool === "patch") {
        void pushState("building", lastProvider ? `${lastProvider}:${tool}` : tool);
      }
    },
    event: async ({ event }: { event: any }) => {
      const t = event?.type ?? event?.event ?? "";
      // Snap to real usage if opencode forwards it
      const realTokens = tryExtractUsage(event);
      if (realTokens && realTokens > estimatedTokens * 0.5) {
        // trust real usage — it's more accurate than estimate
        estimatedTokens = realTokens;
        pressureOverride = null; // use estimate-based pressure now that we have real numbers
        // If we know usage, pressure is directly estimatedTokens/maxTokens — no override needed
      }

      if (t === "session.created") {
        estimatedTokens = 0;
        pressureOverride = 0;
        fixStreak = 0;
        void pushState("planning", t, { pressure: 0, fixStreak: 0, tokensUsed: 0 });
      } else if (t === "session.idle") {
        lastProvider = null;
        trackFix("idle");
        void pushState("idle", t, { fixStreak });
      } else if (t === "session.error") {
        trackFix("error");
        void pushState("error", t, { fixStreak });
      } else if (t === "session.compacted" || t === "session.compact") {
        // compaction = context reset, room clears
        estimatedTokens = Math.round(estimatedTokens * 0.25);
        pressureOverride = null;
        fixStreak = 0;
        void pushState("planning", t, { pressure: currentPressure(), fixStreak: 0 });
      } else if (t.includes("error") || t.includes("fail")) {
        trackFix("error");
        void pushState("error", t, { fixStreak });
      } else if (t.includes("done") || t.includes("complete") || t.includes("finish")) {
        trackFix("done");
        void pushState("done", t, { fixStreak });
      } else if (t.includes("idle") || t.includes("waiting") || t.includes("question") || t.includes("ask")) {
        void pushState("waiting", t);
      } else if (t === "message.updated" || t === "message.part.updated") {
        // Message progress = token tank slowly filling
        if (!realTokens) bumpTokens(120);
        void pushState("building", t);
      }
    },
  };
};
