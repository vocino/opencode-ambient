import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AmbientConfig } from "../types.js";
import { buildAllStateColors } from "../ambient/color.js";

export const CONFIG_DIR = join(homedir(), ".opencode-ambient");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const PID_PATH = join(CONFIG_DIR, "daemon.pid");

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadConfig(): AmbientConfig {
  if (!existsSync(CONFIG_PATH)) throw new Error(`No config at ${CONFIG_PATH}. Run opencode-ambient setup`);
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as AmbientConfig;
}

export function saveConfig(cfg: AmbientConfig): void {
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
