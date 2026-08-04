#!/usr/bin/env node
import { Command } from "commander";
import { runSetup } from "./cli/setup.js";
import { startDaemon, stopDaemon, isDaemonRunning, readPid, handleGlow } from "./daemon/daemon.js";
import { loadConfig, configExists, defaultConfig } from "./config/config.js";
import { glow } from "./ambient/index.js";
import type { AgentState } from "./types.js";

const program = new Command();
program.name("opencode-ambient").description("Ambient lights for opencode — Hue + Govee");

program
  .command("setup")
  .description("Configure Hue + Govee (3 questions)")
  .action(async () => { await runSetup(); });

program
  .command("start")
  .description("Start daemon on 127.0.0.1:7686")
  .action(async () => {
    if (!configExists()) { console.error("No config — run opencode-ambient setup"); process.exit(1); }
    try { await startDaemon(); }
    catch (e: any) { console.error(e?.message ?? e); process.exit(1); }
  });

program
  .command("stop")
  .description("Stop daemon")
  .action(async () => { await stopDaemon(); console.log("stopped"); });

program
  .command("status")
  .description("Daemon status + current state")
  .action(async () => {
    if (!configExists()) { console.log("No config"); return; }
    const cfg = loadConfig();
    console.log(`daemon: ${isDaemonRunning() ? `running pid ${readPid()}` : "stopped"}`);
    console.log(`port: ${cfg.daemon.port} hue: ${cfg.hue.enabled ? `${cfg.hue.lightName} @ ${cfg.hue.ip}` : "off"} govee: ${cfg.govee.enabled ? `${cfg.govee.sku} @ ${cfg.govee.ip}` : "off"}`);
    try {
      const res = await fetch(`http://127.0.0.1:${cfg.daemon.port}/status`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) console.log(`state: ${(await res.json() as any).state}`);
    } catch {}
  });

program
  .command("glow")
  .description("Set state manually")
  .argument("<state>", "idle|planning|building|tool|fixing|waiting|done|error|cursor|meta")
  .action(async (state: string) => {
    const s = state as AgentState;
    if (!configExists()) { const cfg = defaultConfig(); await glow(cfg, s); console.log(`glow ${s} (default, no config)`); return; }
    const cfg = loadConfig();
    if (isDaemonRunning()) {
      await fetch(`http://127.0.0.1:${cfg.daemon.port}/glow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: s }) });
    } else {
      await glow(cfg, s);
    }
    console.log(`glow ${s}`);
  });

program
  .command("demo")
  .description("Cycle all states with glow")
  .action(async () => {
    const states: AgentState[] = ["idle", "planning", "building", "tool", "fixing", "waiting", "cursor", "meta", "done", "error", "idle"];
    const cfg = configExists() ? loadConfig() : defaultConfig();
    for (const s of states) {
      console.log(s);
      try { await glow(cfg, s); } catch (e: any) { console.log(`  ${e?.message ?? e}`); }
      await new Promise((r) => setTimeout(r, 800));
    }
  });

// Hook mode — called via curl from opencode hooks if plugin not used
program
  .command("hook")
  .argument("<state>")
  .argument("[extra]")
  .description("Hook entry (used by opencode.json hooks via curl)")
  .action(async (state: string, extra?: string) => {
    if (!configExists()) return;
    const cfg = loadConfig();
    await handleGlow({ state: state as AgentState, extra } as any, cfg);
  });

program.parseAsync();
