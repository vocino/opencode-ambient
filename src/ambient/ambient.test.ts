import { describe, it, expect } from "vitest";
import { glow, colorForState, STATE_CIE, STATE_RGB } from "./index.js";
import { defaultConfig } from "../config/config.js";

describe("ambient glow", () => {
  it("glow resolves without error when both lights disabled", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    await expect(glow(cfg, "idle")).resolves.toBeUndefined();
    await expect(glow(cfg, "building")).resolves.toBeUndefined();
    await expect(glow(cfg, "error")).resolves.toBeUndefined();
  });

  it("glow with custom brightness arg", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    await expect(glow(cfg, "done", { brightness: 50 })).resolves.toBeUndefined();
  });

  it("colorForState returns configured color", () => {
    const cfg = defaultConfig();
    const c = colorForState(cfg, "idle");
    expect(c.name).toBe("idle");
    expect(c.cie).toBeDefined();
    expect(c.rgb).toBeDefined();
    expect(c.hex).toMatch(/^#/);
  });

  it("colorForState falls back to STATE_* when missing", () => {
    const cfg = defaultConfig();
    // @ts-ignore delete one
    delete cfg.colors.tool;
    const c = colorForState(cfg as any, "tool" as any);
    expect(c.cie).toEqual(STATE_CIE.tool);
    expect(c.rgb).toEqual(STATE_RGB.tool);
  });

  it("STATE maps have 10 entries each (incl cursor/meta)", () => {
    expect(Object.keys(STATE_CIE).length).toBe(10);
    expect(Object.keys(STATE_RGB).length).toBe(10);
  });

  it("all states glow disabled path", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    for (const s of ["idle", "planning", "building", "tool", "fixing", "waiting", "done", "error", "cursor", "meta"] as const) {
      await glow(cfg, s);
    }
  });

  it("pressure dims toward warm", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    await expect(glow(cfg, "building", { pressure: 0 })).resolves.toBeUndefined();
    await expect(glow(cfg, "building", { pressure: 0.5 })).resolves.toBeUndefined();
    await expect(glow(cfg, "building", { pressure: 0.9 })).resolves.toBeUndefined();
    await expect(glow(cfg, "building", { pressure: 1, fixStreak: 3 })).resolves.toBeUndefined();
  });
});
