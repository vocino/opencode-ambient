export type AgentState = "idle" | "planning" | "building" | "tool" | "fixing" | "waiting" | "done" | "error" | "cursor" | "meta";

export interface CieXY { x: number; y: number; }
export interface RgbColor { r: number; g: number; b: number; }

export interface HueConfig {
  enabled: boolean;
  ip: string;
  username: string;
  lightId: number;
  lightName: string;
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
}
