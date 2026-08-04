export type AgentState =
  | "idle"
  | "planning"
  | "building"
  | "tool"
  | "fixing"
  | "waiting"
  | "done"
  | "error"
  // providers — short list, where money/limit lives
  | "cursor"
  | "meta"
  | "anthropic"
  | "openai"
  | "openrouter"
  | "google"
  | "local";

export interface CieXY { x: number; y: number; }
export interface RgbColor { r: number; g: number; b: number; }

export interface HueConfig {
  enabled: boolean;
  ip: string;
  username: string;
  lightId: number;
  lightName: string;
  // optional multi-light room: when set, glow fans out to all of these
  lightIds?: number[];
  roomGroup?: string;
}

export interface GoveeConfig {
  enabled: boolean;
  ip: string;
  device: string;
  sku: string;
}

export interface ColorConfig {
  start: CieXY;
  end: CieXY;
}

export interface RgbColorConfig {
  start: RgbColor;
  end: RgbColor;
}

export interface BrightnessConfig {
  start: number;
  end: number;
}

export interface StateColor {
  name: AgentState;
  hex: string;
  cie: CieXY;
  rgb: RgbColor;
}

export interface AmbientConfig {
  hue: HueConfig;
  govee: GoveeConfig;
  colors: Record<AgentState, StateColor>;
  brightness: BrightnessConfig;
  daemon: {
    port: number;
    transitionMs: number;
    idleReturnMs: number;
  };
}

export interface GlowRequest {
  state: AgentState;
  agent?: string;
  extra?: string;
  // token tank / pressure — 0..1 how close to context / plan limit. daemon dims & warms as this rises
  pressure?: number;
  usagePercent?: number; // alias for pressure, 0..100
  tokensUsed?: number;
  tokensMax?: number;
  // fix loop intensity: how many fixes in recent window
  fixStreak?: number;
  // optional brightness override from plugin (e.g. dim as tank drains)
  brightness?: number;
  transitionMs?: number;
}
