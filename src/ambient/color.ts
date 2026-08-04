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
  // sRGB -> XYZ -> xy, same as claude-hue v2
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

export const STATE_PRESETS: Record<AgentState, string> = {
  idle: "#40a02b",      // green calm
  planning: "#1793d1",  // blue thinking (Arch blue from your stack)
  building: "#fe640b",  // orange writing code
  tool: "#04a5e5",      // cyan tool calls
  fixing: "#fe640b",    // orange -> red for repair
  waiting: "#8839ef",   // purple needs input
  done: "#ffffff",      // white flash complete
  error: "#d20f39",     // red error
  cursor: "#facc15",    // Cursor yellow — distinct, you see Cursor council running
  meta: "#0064d1",      // Meta blue — deep Meta AI
};

export function buildStateColor(state: AgentState): StateColor {
  const hex = STATE_PRESETS[state];
  const rgb = hexToRgb(hex)!;
  const cie = rgbToCie(rgb.r, rgb.g, rgb.b);
  return { name: state, hex, cie, rgb };
}

export function buildAllStateColors(): Record<AgentState, StateColor> {
  return {
    idle: buildStateColor("idle"),
    planning: buildStateColor("planning"),
    building: buildStateColor("building"),
    tool: buildStateColor("tool"),
    fixing: buildStateColor("fixing"),
    waiting: buildStateColor("waiting"),
    done: buildStateColor("done"),
    error: buildStateColor("error"),
    cursor: buildStateColor("cursor"),
    meta: buildStateColor("meta"),
  };
}
