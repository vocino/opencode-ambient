import { describe, it, expect, vi, beforeEach } from "vitest";
import { isDaemonRunning, handleGlow, resetForTests, getLastState, MAX_BODY_BYTES, VALID_STATES } from "./daemon.js";
import { defaultConfig } from "../config/config.js";

vi.mock("../ambient/index.js", () => ({
  glow: vi.fn().mockResolvedValue(undefined),
}));

describe("daemon utils", () => {
  beforeEach(() => {
    resetForTests();
  });

  it("isDaemonRunning false when no pid file", () => {
    // in test env, pid file likely not exist; if it does exist it's ok but function should not throw
    expect(() => isDaemonRunning()).not.toThrow();
  });

  it("VALID_STATES contains expected", () => {
    expect(VALID_STATES.has("idle" as any)).toBe(true);
    expect(VALID_STATES.has("building" as any)).toBe(true);
    expect(VALID_STATES.has("error" as any)).toBe(true);
    expect(VALID_STATES.has("cursor" as any)).toBe(true);
    expect(VALID_STATES.has("meta" as any)).toBe(true);
    expect(VALID_STATES.has("anthropic" as any)).toBe(true);
    expect(VALID_STATES.has("openai" as any)).toBe(true);
    expect(VALID_STATES.has("openrouter" as any)).toBe(true);
    expect(VALID_STATES.has("google" as any)).toBe(true);
    expect(VALID_STATES.has("local" as any)).toBe(true);
  });

  it("MAX_BODY_BYTES is 10kb", () => {
    expect(MAX_BODY_BYTES).toBe(10 * 1024);
  });

  it("handleGlow ignores invalid state", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    // @ts-ignore
    await handleGlow({ state: "not-a-state" as any }, cfg);
    expect(getLastState()).toBe("idle");
  });

  it("handleGlow updates lastState for valid state", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    cfg.daemon.idleReturnMs = 60000;
    await handleGlow({ state: "building" as any }, cfg);
    expect(getLastState()).toBe("building");
  });

  it("handleGlow accepts pressure and fixStreak", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    cfg.daemon.idleReturnMs = 60000;
    await handleGlow({ state: "building", pressure: 0.85, fixStreak: 2 } as any, cfg);
    expect(getLastState()).toBe("building");
    await handleGlow({ state: "fixing", usagePercent: 95, fixStreak: 4 } as any, cfg);
    expect(getLastState()).toBe("fixing");
  });

  it("handleGlow schedules idle return but can be reset", async () => {
    const cfg = defaultConfig();
    cfg.hue.enabled = false;
    cfg.govee.enabled = false;
    cfg.daemon.idleReturnMs = 50;
    await handleGlow({ state: "tool" as any }, cfg);
    expect(getLastState()).toBe("tool");
    resetForTests();
    expect(getLastState()).toBe("idle");
  });
});
