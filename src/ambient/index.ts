import type { AgentState, CieXY, RgbColor, StateColor, AmbientConfig } from "../types.js";
import { setHueColor } from "./hue.js";
import { setGoveeColor, setGoveeBrightness, setGoveePower } from "./govee.js";
import { pressureBlend, fixPulseBrightness, fixPulseTransition } from "./color.js";

export const STATE_CIE: Record<AgentState, CieXY> = {
  idle: { x: 0.2151, y: 0.7106 },
  planning: { x: 0.15, y: 0.22 },
  building: { x: 0.562, y: 0.416 },
  tool: { x: 0.17, y: 0.35 },
  fixing: { x: 0.556, y: 0.413 },
  waiting: { x: 0.25, y: 0.12 },
  done: { x: 0.3227, y: 0.329 },
  error: { x: 0.675, y: 0.322 },
  cursor: { x: 0.468, y: 0.481 },    // #facc15
  meta: { x: 0.14, y: 0.08 },      // #0064d1
  anthropic: { x: 0.47, y: 0.38 },  // #d97757 clay
  openai: { x: 0.206, y: 0.46 },    // #10a37f teal
  openrouter: { x: 0.22, y: 0.13 },  // #8b5cf6 violet
  google: { x: 0.16, y: 0.18 },   // #4285f4 light blue
  local: { x: 0.33, y: 0.34 },      // #9ca3af slate
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
  anthropic: { r: 217, g: 119, b: 87 },
  openai: { r: 16, g: 163, b: 127 },
  openrouter: { r: 139, g: 92, b: 246 },
  google: { r: 66, g: 133, b: 244 },
  local: { r: 156, g: 163, b: 175 },
};

// Unified glow — ONE function does both Hue and Govee, failsafe
export async function glow(config: AmbientConfig, state: AgentState, opts?: { brightness?: number; pressure?: number; fixStreak?: number; transitionMs?: number }): Promise<void> {
  const baseColor = (config.colors as any)[state] ?? { cie: STATE_CIE[state], rgb: STATE_RGB[state] } as any;
  const baseCie = (baseColor as any).cie ?? STATE_CIE[state];
  const baseRgb = (baseColor as any).rgb ?? STATE_RGB[state];

  let cie = baseCie;
  let rgb = baseRgb;
  let bri = typeof opts?.brightness === "number" ? opts.brightness : config.brightness?.start ?? 100;
  let tt = typeof opts?.transitionMs === "number" ? opts.transitionMs : config.daemon?.transitionMs ?? 400;

  // Pressure = token tank draining: shift color warm + dim
  if (typeof opts?.pressure === "number" && opts.pressure > 0.01) {
    const blend = pressureBlend({ name: state, hex: "", cie: baseCie, rgb: baseRgb } as any, opts.pressure);
    cie = blend.cie;
    rgb = blend.rgb;
    bri = Math.round(bri * blend.brightnessFactor);
  }

  // Fix streak pulse — urgency when stuck in fix loop
  const fixStreak = opts?.fixStreak ?? 0;
  if (fixStreak > 1) {
    bri = fixPulseBrightness(bri, fixStreak);
    tt = fixPulseTransition(tt, fixStreak);
  }

  const tasks: Promise<void>[] = [];

  if (config.hue?.enabled) {
    // Multi-light room fan-out: if lightIds present, glow them all
    const ids = (config.hue as any).lightIds?.length ? (config.hue as any).lightIds : [config.hue.lightId];
    for (const id of ids) {
      tasks.push(
        (async () => {
          try {
            await setHueColor(config.hue.ip, config.hue.username, id, cie, bri, tt);
          } catch {
            // network device may be unreachable — keep ambient non-blocking
          }
        })(),
      );
    }
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
