import { describe, expect, it } from "vitest";
import { assertValidMarkerId, normaliseMarkerSlugOrThrow } from "./marker-ids.js";

describe("Marker id validation rules", () => {
  it("accepts short alphanumeric ids", () => {
    expect(assertValidMarkerId("abc123")).toBe("abc123");
  });

  it("accepts hyphenated and underscored slugs", () => {
    expect(assertValidMarkerId("Auth-Flow_v2")).toBe("auth-flow_v2");
  });

  it("rejects empty and invalid punctuation", () => {
    expect(() => assertValidMarkerId("")).toThrow(/Invalid marker id/);
    expect(() => assertValidMarkerId("bad!")).toThrow(/Invalid marker id/);
    expect(() => assertValidMarkerId("-start")).toThrow(/Invalid marker id/);
  });
});

describe("Normalising marker ids to URL-safe slugs", () => {
  it("slugifies human phrases", () => {
    expect(normaliseMarkerSlugOrThrow("  Auth flow (v2) ")).toBe("auth-flow-v2");
  });
});
