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
    expect(Object.keys(all).length).toBe(8);
  });
});
