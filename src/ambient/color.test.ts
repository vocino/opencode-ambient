import { describe, it, expect } from "vitest";
import { buildAllStateColors, hexToCieXY, STATE_PRESETS } from "./color.js";

describe("colors", () => {
  it("presets parse", () => {
    for (const [k, v] of Object.entries(STATE_PRESETS)) {
      const cie = hexToCieXY(v);
      expect(cie, `${k} ${v} cie`).toBeTruthy();
    }
  });
  it("all states", () => {
    const all = buildAllStateColors();
    // 8 lifecycle + 7 providers = 15
    expect(Object.keys(all).length).toBe(15);
  });
  it("provider hues distinct", () => {
    const providers = ["cursor","meta","anthropic","openai","openrouter","google","local"] as const;
    for (const p of providers) {
      expect(STATE_PRESETS[p], p).toBeTruthy();
      expect(hexToCieXY(STATE_PRESETS[p])).toBeTruthy();
    }
  });
});
