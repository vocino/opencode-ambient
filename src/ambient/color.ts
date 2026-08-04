import type { CieXY, RgbColor, StateColor, AgentState } from "../types.js";

function hexToRgb(hex: string): RgbColor | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1];
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToCie(r: number, g: number, b: number): CieXY {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  const X = R * 0.664511 + G * 0.154324 + B * 0.162028;
  const Y = R * 0.283881 + G * 0.668433 + B * 0.047685;
  const Z = R * 0.000088 + G * 0.07231 + B * 0.986039;
  const sum = X + Y + Z;
  if (sum === 0) return { x: 0, y: 0 };
  return { x: X / sum, y: Y / sum };
}

export function hexToCieXY(hex: string): CieXY | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToCie(rgb.r, rgb.g, rgb.b);
}

export function hexToRgbColor(hex: string): RgbColor | null {
  return hexToRgb(hex);
}

export function interpolateColor(start: CieXY, end: CieXY, t: number): CieXY {
  const c = Math.max(0, Math.min(1, t));
  return { x: start.x + (end.x - start.x) * c, y: start.y + (end.y - start.y) * c };
}

export function interpolateRgb(start: RgbColor, end: RgbColor, t: number): RgbColor {
  const c = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(start.r + (end.r - start.r) * c),
    g: Math.round(start.g + (end.g - start.g) * c),
    b: Math.round(start.b + (end.b - start.b) * c),
  };
}

// Pressure blending: token tank 0..1 -> warm shift + dim
// See docs/PRINCIPLES.md §2 — brightness IS life, warmth IS cost

export interface PressureBlend {
  cie: CieXY;
  rgb: RgbColor;
  brightnessFactor: number; // 1.0 → 0.35 drained
}

export function pressureBlend(base: StateColor, pressure: number): PressureBlend {
  const p = Math.max(0, Math.min(1, pressure));
  if (p < 0.01) return { cie: base.cie, rgb: base.rgb, brightnessFactor: 1 };

  // Gradient: 0% base → 40% 20% toward amber → 70% amber → 85% orange → 95%+ red
  const warnAmber: RgbColor = { r: 250, g: 204, b: 21 }; // #facc15
  const hotOrange: RgbColor = { r: 254, g: 100, b: 11 }; // #fe640b
  const drainedRed: RgbColor = { r: 210, g: 15, b: 57 }; // #d20f39

  let targetRgb: RgbColor;

  if (p < 0.4) {
    const t = (p / 0.4) * 0.2;
    targetRgb = interpolateRgb(base.rgb, warnAmber, t);
  } else if (p < 0.7) {
    const t = (p - 0.4) / 0.3;
    const mid = interpolateRgb(base.rgb, warnAmber, 0.2);
    targetRgb = interpolateRgb(mid, warnAmber, t * 0.8);
  } else if (p < 0.85) {
    const t = (p - 0.7) / 0.15;
    targetRgb = interpolateRgb(warnAmber, hotOrange, t);
  } else {
    const t = (p - 0.85) / 0.15;
    targetRgb = interpolateRgb(hotOrange, drainedRed, Math.min(1, t));
  }

  const targetCie = rgbToCie(targetRgb.r, targetRgb.g, targetRgb.b);

  // Brightness dims as tank drains: 100% → 90% @0.7 → 75% @0.85 → 55% @0.95 → 35% @1.0
  let bf = 1;
  if (p < 0.7) bf = 1 - p * 0.15;
  else if (p < 0.85) bf = 0.895 - ((p - 0.7) / 0.15) * 0.15;
  else if (p < 0.95) bf = 0.75 - ((p - 0.85) / 0.1) * 0.2;
  else bf = 0.55 - ((p - 0.95) / 0.05) * 0.2;
  bf = Math.max(0.3, Math.min(1, bf));

  return { cie: targetCie, rgb: targetRgb, brightnessFactor: bf };
}

export function fixPulseBrightness(baseBri: number, fixStreak: number): number {
  if (fixStreak <= 1) return baseBri;
  const bump = Math.min(20, (fixStreak - 1) * 6);
  return Math.min(100, baseBri + bump);
}

export function fixPulseTransition(baseMs: number, fixStreak: number): number {
  if (fixStreak <= 2) return baseMs;
  if (fixStreak === 3) return Math.max(120, Math.floor(baseMs * 0.6));
  if (fixStreak >= 4) return Math.max(80, Math.floor(baseMs * 0.4));
  return baseMs;
}

// Provider-indexed palette — where your money goes is what glows
// Principles: docs/PRINCIPLES.md §1 — 7 providers, ≤8 hues, distinct at 35% brightness
export const STATE_PRESETS: Record<AgentState, string> = {
  // lifecycle
  idle: "#40a02b",        // green calm
  planning: "#1793d1",   // blue thinking
  building: "#fe640b",   // orange writing code
  tool: "#04a5e5",       // cyan tool calls
  fixing: "#fe640b",     // orange repair (uses fix streak for urgency, not color)
  waiting: "#8839ef",     // purple needs input
  done: "#ffffff",        // white flash
  error: "#d20f39",       // red

  // providers — distinct hues >30° apart, tested at 35% brightness
  cursor: "#facc15",     // yellow amber — Cursor proxy
  meta: "#0064d1",       // deep blue — Meta
  anthropic: "#d97757",  // clay orange — Claude direct
  openai: "#10a37f",     // teal — OpenAI
  openrouter: "#8b5cf6", // violet — router spend
  google: "#4285f4",     // light blue — Gemini
  local: "#9ca3af",      // slate — ollama / local llm
};

export function buildStateColor(state: AgentState): StateColor {
  const hex = STATE_PRESETS[state];
  const rgb = hexToRgb(hex)!;
  const cie = rgbToCie(rgb.r, rgb.g, rgb.b);
  return { name: state, hex, cie, rgb };
}

export function buildAllStateColors(): Record<AgentState, StateColor> {
  return Object.fromEntries(
    (Object.keys(STATE_PRESETS) as AgentState[]).map(k => [k, buildStateColor(k)])
  ) as Record<AgentState, StateColor>;
}
