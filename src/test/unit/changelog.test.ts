import { describe, it, expect } from "vitest";
import { CHANGELOG } from "@/data/changelog";

describe("Unit: Changelog Integrity (data/changelog)", () => {
  it("CHANGELOG should contain entries with valid date format (YYYY-MM-DD)", () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("CHANGELOG entries should be unique by date and description", () => {
    const seen = new Set<string>();
    for (const entry of CHANGELOG) {
      const key = `${entry.date}::${entry.description}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
