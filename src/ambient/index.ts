import type { AgentState, CieXY, RgbColor, StateColor, AmbientConfig } from "../types.js";
import { setHueColor } from "./hue.js";
import { setGoveeColor, setGoveeBrightness, setGoveePower } from "./govee.js";

export const STATE_CIE: Record<AgentState, CieXY> = {
  idle: { x: 0.2151, y: 0.7106 },
  planning: { x: 0.15, y: 0.22 },
  building: { x: 0.562, y: 0.416 },
  tool: { x: 0.17, y: 0.35 },
  fixing: { x: 0.556, y: 0.413 },
  waiting: { x: 0.25, y: 0.12 },
  done: { x: 0.3227, y: 0.329 },
  error: { x: 0.675, y: 0.322 },
  cursor: { x: 0.468, y: 0.481 },  // #facc15 yellow amber
  meta: { x: 0.14, y: 0.08 },      // #0064d1 deep meta blue
};

export const STATE_RGB: Record<AgentState, RgbColor> = {
  idle: { r: 64, g: 160, b: 43 },
  planning: { r: 23, g: 147, b: 209 },
  building: { r: 254, g: 100, b: 11 },
  tool: { r: 4, g: 165, b: 229 },
  fixing: { r: 254, g: 100, b: 11 },
  waiting: { r: 136, g: 57, b: 239 },
  done: { r: 255, g: 255, b: 255 },
  error: { r: 210, g: 15, b: 57 },
  cursor: { r: 250, g: 204, b: 21 },
  meta: { r: 0, g: 100, b: 209 },
};

// Unified glow — ONE function does both Hue and Govee, failsafe
export async function glow(config: AmbientConfig, state: AgentState, opts?: { brightness?: number }): Promise<void> {
  const cie = config.colors[state]?.cie ?? STATE_CIE[state];
  const rgb = config.colors[state]?.rgb ?? STATE_RGB[state];
  const bri = typeof opts?.brightness === "number" ? opts.brightness : config.brightness?.start ?? 100;
  const tt = config.daemon?.transitionMs ?? 400;

  const tasks: Promise<void>[] = [];

  if (config.hue?.enabled) {
    tasks.push(
      (async () => {
        try {
          await setHueColor(config.hue.ip, config.hue.username, config.hue.lightId, cie, bri, tt);
        } catch {
          // network device may be unreachable — keep ambient non-blocking
        }
      })(),
    );
  }

  if (config.govee?.enabled) {
    tasks.push(
      (async () => {
        try {
          await setGoveePower(config.govee.ip, true);
          await setGoveeBrightness(config.govee.ip, bri);
          await setGoveeColor(config.govee.ip, rgb);
        } catch {
          // non-blocking
        }
      })(),
    );
  }

  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
}

// Local blending for smooth transitions without bridge roundtrips
export function colorForState(config: AmbientConfig, state: AgentState): StateColor {
  const c = config.colors?.[state];
  if (c) return c;
  return {
    name: state,
    hex: "#ffffff",
    cie: STATE_CIE[state] ?? STATE_CIE.idle,
    rgb: STATE_RGB[state] ?? STATE_RGB.idle,
  };
}
