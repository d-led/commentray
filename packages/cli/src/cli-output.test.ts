import { afterEach, describe, expect, it, vi } from "vitest";

import { formatCliError, formatCliWarning, stderrColorsEnabled } from "./cli-output.js";

describe("cli-output", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("given NO_COLOR, does not wrap stderr messages", () => {
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("FORCE_COLOR", "1");
    expect(stderrColorsEnabled()).toBe(false);
    expect(formatCliWarning("hello")).toBe("hello");
    expect(formatCliError("oops")).toBe("oops");
  });

  it("given FORCE_COLOR when color blockers are absent, wraps warning and error text", () => {
    const saved = {
      NO_COLOR: process.env.NO_COLOR,
      NODE_DISABLE_COLORS: process.env.NODE_DISABLE_COLORS,
      FORCE_COLOR: process.env.FORCE_COLOR,
    };
    Reflect.deleteProperty(process.env, "NO_COLOR");
    Reflect.deleteProperty(process.env, "NODE_DISABLE_COLORS");
    process.env.FORCE_COLOR = "1";
    const csi = String.fromCodePoint(0x1b);
    try {
      expect(stderrColorsEnabled()).toBe(true);
      const warn = formatCliWarning("[warn] x");
      expect(warn.startsWith(`${csi}[1m${csi}[33m`)).toBe(true);
      expect(warn.endsWith(`${csi}[0m`)).toBe(true);
      expect(formatCliError("[error] x").startsWith(`${csi}[1m${csi}[31m`)).toBe(true);
    } finally {
      for (const key of ["NO_COLOR", "NODE_DISABLE_COLORS", "FORCE_COLOR"] as const) {
        const v = saved[key];
        if (v === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = v;
      }
    }
  });
});
