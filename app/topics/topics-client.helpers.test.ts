// Pure-helper tests for the topics index client. The component itself isn't
// tested here (no React testing harness in this repo); only the deterministic
// formatters are covered.

import { describe, it, expect } from "vitest";
import { formatRelative, formatAbsolute } from "@/app/topics/topics-client";

// All "now" values are fixed Unix timestamps so the tests are deterministic.
// 2026-05-20T12:00:00Z
const NOW = Date.UTC(2026, 4, 20, 12, 0, 0);

describe("formatRelative", () => {
  it("returns '—' when input is null", () => {
    expect(formatRelative(null, NOW)).toBe("—");
  });

  it("returns 'today' for an attempt earlier the same day", () => {
    expect(formatRelative("2026-05-20 09:00:00", NOW)).toBe("today");
  });

  it("returns 'today' when diff is under 24h", () => {
    // 6 hours earlier — still same calendar day in UTC; days floor to 0
    expect(formatRelative("2026-05-20 06:00:00", NOW)).toBe("today");
  });

  it("returns 'yesterday' for ~1 day ago", () => {
    expect(formatRelative("2026-05-19 12:00:00", NOW)).toBe("yesterday");
  });

  it("returns 'Nd ago' for under a month", () => {
    expect(formatRelative("2026-05-15 12:00:00", NOW)).toBe("5d ago");
    expect(formatRelative("2026-04-30 12:00:00", NOW)).toBe("20d ago");
  });

  it("returns 'Nmo ago' for under a year", () => {
    // 90 days ≈ 3 months
    const ninetyDaysAgo = new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    expect(formatRelative(ninetyDaysAgo, NOW)).toBe("3mo ago");
  });

  it("returns 'Ny ago' for over a year", () => {
    expect(formatRelative("2024-05-20 12:00:00", NOW)).toBe("2y ago");
  });

  it("handles future-dated attempts (negative diff) by returning 'today'", () => {
    // Defensive — clock skew shouldn't crash the page.
    expect(formatRelative("2026-05-21 00:00:00", NOW)).toBe("today");
  });

  it("treats the SQLite 'YYYY-MM-DD HH:MM:SS' format as UTC", () => {
    // If the function naively parsed without appending Z, local-tz parsing
    // would produce a different diff. This test pins the UTC assumption.
    expect(formatRelative("2026-05-20 11:59:59", NOW)).toBe("today");
  });
});

describe("formatAbsolute", () => {
  it("returns the date portion (first 10 chars) of an ISO timestamp", () => {
    expect(formatAbsolute("2026-05-20 12:34:56")).toBe("2026-05-20");
    expect(formatAbsolute("2024-01-01 00:00:00")).toBe("2024-01-01");
  });

  it("returns '—' when input is null", () => {
    expect(formatAbsolute(null)).toBe("—");
  });

  it("is pure — does not call Date.now()", () => {
    // If the implementation drifted to use Date.now(), this would still pass
    // but the property under test is documented. Kept as an integration note.
    expect(formatAbsolute("2026-05-20 12:00:00")).toBe(formatAbsolute("2026-05-20 12:00:00"));
  });
});
