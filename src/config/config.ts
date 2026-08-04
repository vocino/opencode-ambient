import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AmbientConfig, AgentState } from "../types.js";
import { buildAllStateColors } from "../ambient/color.js";

export const CONFIG_DIR = join(homedir(), ".opencode-ambient");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const PID_PATH = join(CONFIG_DIR, "daemon.pid");

export const VALID_STATES: AgentState[] = [
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
];

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

export function validateConfig(cfg: any): string[] {
  const errors: string[] = [];
  if (!cfg || typeof cfg !== "object") {
    return ["config must be an object"];
  }

  // hue
  if (!cfg.hue || typeof cfg.hue !== "object") {
    errors.push("hue config missing");
  } else {
    if (typeof cfg.hue.enabled !== "boolean") errors.push("hue.enabled must be boolean");
    if (cfg.hue.enabled) {
      if (!cfg.hue.ip || typeof cfg.hue.ip !== "string" || cfg.hue.ip.trim() === "") {
        errors.push("hue.ip required when hue.enabled");
      }
      if (cfg.hue.lightId != null && (typeof cfg.hue.lightId !== "number" || cfg.hue.lightId < 1)) {
        errors.push("hue.lightId must be >= 1");
      }
      if (cfg.hue.lightIds != null) {
        if (!Array.isArray(cfg.hue.lightIds) || cfg.hue.lightIds.some((n: any) => typeof n !== "number" || n < 1)) {
          errors.push("hue.lightIds must be array of numbers >=1");
        }
      }
    }
    if (cfg.hue.ip && typeof cfg.hue.ip === "string" && cfg.hue.ip.length > 253) {
      errors.push("hue.ip too long");
    }
  }

  // govee
  if (!cfg.govee || typeof cfg.govee !== "object") {
    errors.push("govee config missing");
  } else {
    if (typeof cfg.govee.enabled !== "boolean") errors.push("govee.enabled must be boolean");
    if (cfg.govee.enabled) {
      if (!cfg.govee.ip || typeof cfg.govee.ip !== "string" || cfg.govee.ip.trim() === "") {
        errors.push("govee.ip required when govee.enabled");
      }
    }
  }

  // colors
  if (!cfg.colors || typeof cfg.colors !== "object") {
    errors.push("colors missing");
  } else {
    for (const s of VALID_STATES) {
      const c = cfg.colors[s];
      if (!c) {
        errors.push(`colors.${s} missing`);
      } else {
        if (!c.hex || typeof c.hex !== "string") errors.push(`colors.${s}.hex invalid`);
        if (!c.cie || typeof c.cie.x !== "number" || typeof c.cie.y !== "number") {
          errors.push(`colors.${s}.cie invalid`);
        }
        if (!c.rgb || typeof c.rgb.r !== "number" || typeof c.rgb.g !== "number" || typeof c.rgb.b !== "number") {
          errors.push(`colors.${s}.rgb invalid`);
        }
      }
    }
  }

  // brightness
  if (!cfg.brightness || typeof cfg.brightness !== "object") {
    errors.push("brightness missing");
  } else {
    const { start, end } = cfg.brightness;
    if (typeof start !== "number" || start < 0 || start > 100) {
      errors.push("brightness.start must be 0-100");
    }
    if (typeof end !== "number" || end < 0 || end > 100) {
      errors.push("brightness.end must be 0-100");
    }
  }

  // daemon
  if (!cfg.daemon || typeof cfg.daemon !== "object") {
    errors.push("daemon config missing");
  } else {
    const { port, transitionMs, idleReturnMs } = cfg.daemon;
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push("daemon.port must be 1-65535");
    }
    if (typeof transitionMs !== "number" || transitionMs < 0 || transitionMs > 10000) {
      errors.push("daemon.transitionMs must be 0-10000");
    }
    if (typeof idleReturnMs !== "number" || idleReturnMs < 1000 || idleReturnMs > 600000) {
      errors.push("daemon.idleReturnMs must be >=1000 and <=600000");
    }
  }

  return errors;
}

export function loadConfig(): AmbientConfig {
  if (!existsSync(CONFIG_PATH)) throw new Error(`No config at ${CONFIG_PATH}. Run opencode-ambient setup`);
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (e: any) {
    throw new Error(`Invalid config JSON at ${CONFIG_PATH}: ${e?.message ?? e}`);
  }
  // auto-heal: fill missing colors from defaults so old configs keep working when we add states
  try {
    const defaults = buildAllStateColors();
    if (raw.colors && typeof raw.colors === "object") {
      for (const k of Object.keys(defaults) as (keyof typeof defaults)[]) {
        if (!raw.colors[k]) raw.colors[k] = (defaults as any)[k];
      }
    }
  } catch {}
  const errs = validateConfig(raw);
  if (errs.length) {
    throw new Error(`Invalid config: ${errs.join("; ")}`);
  }
  return raw as AmbientConfig;
}

export function saveConfig(cfg: AmbientConfig): void {
  const errs = validateConfig(cfg);
  if (errs.length) {
    throw new Error(`Refusing to save invalid config: ${errs.join("; ")}`);
  }
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function defaultConfig(): AmbientConfig {
  return {
    hue: { enabled: false, ip: "10.0.0.10", username: "", lightId: 1, lightName: "Office" },
    govee: { enabled: false, ip: "10.0.0.11", device: "", sku: "H60B0" },
    colors: buildAllStateColors(),
    brightness: { start: 100, end: 100 },
    daemon: { port: 7686, transitionMs: 400, idleReturnMs: 30000 },
  };
}
