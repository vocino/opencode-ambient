import { describe, it, expect } from "vitest";
import { STATE_MAP } from "./plugin.js";

describe("plugin STATE_MAP completeness", () => {
  it("maps common tools", () => {
    expect(STATE_MAP.read).toBe("tool");
    expect(STATE_MAP.write).toBe("building");
    expect(STATE_MAP.bash).toBe("tool");
    expect(STATE_MAP.edit).toBe("building");
  });

  it("maps todo/read task flows to planning", () => {
    expect(STATE_MAP.todoread).toBe("planning");
    expect(STATE_MAP.todowrite).toBe("planning");
    expect(STATE_MAP.task).toBe("planning");
    expect(STATE_MAP.todo_read).toBe("planning");
    expect(STATE_MAP.todo_write).toBe("planning");
  });

  it("maps question/waiting", () => {
    expect(STATE_MAP.question).toBe("waiting");
    expect(STATE_MAP.ask).toBe("waiting");
    expect(STATE_MAP.ask_user).toBe("waiting");
  });

  it("maps opencode and fixing concepts", () => {
    expect(STATE_MAP.opencode).toBe("building");
    expect(STATE_MAP.fix).toBe("fixing");
    expect(STATE_MAP.retry).toBe("fixing");
  });

  it("maps webfetch variants", () => {
    expect(STATE_MAP.webfetch).toBe("tool");
    expect(STATE_MAP.web_fetch).toBe("tool");
  });

  it("has at least 12 entries (maturity)", () => {
    expect(Object.keys(STATE_MAP).length).toBeGreaterThanOrEqual(12);
  });
});
