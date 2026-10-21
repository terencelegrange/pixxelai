import { describe, it, expect } from "vitest";
import { getDisplayAvatar } from "@/lib/avatar";

describe("Unit: Avatar Selection Utilities (lib/avatar)", () => {
  it("should return the explicit avatar ID when within valid 1-127 range", () => {
    expect(getDisplayAvatar(1, 42)).toBe(1);
    expect(getDisplayAvatar(42, 100)).toBe(42);
    expect(getDisplayAvatar(127, 999)).toBe(127);
  });

  it("should compute deterministic avatar from positive user ID when avatar is null or undefined", () => {
    expect(getDisplayAvatar(null, 1)).toBe(1);
    expect(getDisplayAvatar(undefined, 2)).toBe(2);
    expect(getDisplayAvatar(null, 127)).toBe(127);
    expect(getDisplayAvatar(null, 128)).toBe(1); // (128 - 1) % 127 + 1 = 1
    expect(getDisplayAvatar(undefined, 129)).toBe(2);
  });

  it("should return fallback avatar 1 for null, undefined, or non-positive user ID", () => {
    expect(getDisplayAvatar(null, null)).toBe(1);
    expect(getDisplayAvatar(null, undefined)).toBe(1);
    expect(getDisplayAvatar(null, 0)).toBe(1);
    expect(getDisplayAvatar(null, -10)).toBe(1);
  });

  it("should ignore out-of-range explicit avatar IDs (< 1 or > 127) and fallback to uid calculation", () => {
    expect(getDisplayAvatar(0, 5)).toBe(5);
    expect(getDisplayAvatar(128, 5)).toBe(5);
    expect(getDisplayAvatar(-1, 10)).toBe(10);
  });
});
