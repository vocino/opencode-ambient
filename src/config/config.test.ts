import { describe, it, expect } from "vitest";
import { validateConfig, defaultConfig } from "./config.js";

describe("config validation", () => {
  it("default config is valid", () => {
    const cfg = defaultConfig();
    const errs = validateConfig(cfg);
    expect(errs).toEqual([]);
  });

  it("rejects bad port", () => {
    const cfg: any = { ...defaultConfig(), daemon: { port: 0, transitionMs: 400, idleReturnMs: 30000 } };
    expect(validateConfig(cfg).some((e) => e.includes("port"))).toBe(true);
    cfg.daemon.port = 70000;
    expect(validateConfig(cfg).some((e) => e.includes("port"))).toBe(true);
  });

  it("rejects negative transition", () => {
    const cfg: any = { ...defaultConfig(), daemon: { port: 7686, transitionMs: -1, idleReturnMs: 30000 } };
    expect(validateConfig(cfg).some((e) => e.includes("transitionMs"))).toBe(true);
  });

  it("rejects too short idleReturnMs", () => {
    const cfg: any = { ...defaultConfig(), daemon: { port: 7686, transitionMs: 400, idleReturnMs: 100 } };
    expect(validateConfig(cfg).some((e) => e.includes("idleReturnMs"))).toBe(true);
  });

  it("rejects brightness out of range", () => {
    const cfg: any = { ...defaultConfig(), brightness: { start: 101, end: -1 } };
    const errs = validateConfig(cfg);
    expect(errs.filter((e) => e.includes("brightness")).length).toBe(2);
  });

  it("requires hue ip when enabled", () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = true;
    cfg.hue.ip = "";
    expect(validateConfig(cfg as any).some((e) => e.includes("hue.ip"))).toBe(true);
  });

  it("requires govee ip when enabled", () => {
    const cfg = defaultConfig();
    cfg.govee.enabled = true;
    cfg.govee.ip = "";
    expect(validateConfig(cfg as any).some((e) => e.includes("govee.ip"))).toBe(true);
  });

  it("rejects missing hue", () => {
    const cfg: any = { ...defaultConfig() };
    delete cfg.hue;
    expect(validateConfig(cfg).some((e) => e.includes("hue"))).toBe(true);
  });

  it("handles non-object", () => {
    expect(validateConfig(null).length).toBeGreaterThan(0);
    expect(validateConfig("string" as any).length).toBeGreaterThan(0);
  });

  it("rejects invalid color entry", () => {
    const cfg: any = defaultConfig();
    cfg.colors.idle.hex = null;
    expect(validateConfig(cfg).some((e) => e.includes("idle"))).toBe(true);
  });

  it("save/load roundtrip validates", async () => {
    // do NOT touch real homedir; test save/load via temp
    // We only test that defaultConfig passes validate, and JSON roundtrip preserves validity
    const cfg = defaultConfig();
    const json = JSON.stringify(cfg);
    const parsed = JSON.parse(json);
    expect(validateConfig(parsed)).toEqual([]);
  });
});
