import { describe, it, expect } from "vitest";
import { computeSessions, computeSessionStats, type AttemptPoint } from "./session-tracker";

// Helper: ISO string for a minute offset from a fixed base.
const BASE = new Date("2026-04-22T10:00:00.000Z").getTime();
const at = (minFromBase: number): string =>
  new Date(BASE + minFromBase * 60_000).toISOString();

describe("computeSessions", () => {
  it("returns empty array for no attempts", () => {
    expect(computeSessions([])).toEqual([]);
  });

  it("single attempt with no timeSpent → 1-min session (floor)", () => {
    const s = computeSessions([{ attemptedAt: at(0), topic: "kinetics", timeSpent: null }]);
    expect(s).toHaveLength(1);
    expect(s[0].attemptCount).toBe(1);
    expect(s[0].durationMin).toBe(1);
    expect(s[0].topics).toEqual(["kinetics"]);
  });

  it("single attempt uses timeSpent as duration proxy", () => {
    const s = computeSessions([{ attemptedAt: at(0), topic: "kinetics", timeSpent: 600 }]); // 10 min
    expect(s[0].durationMin).toBe(10);
  });

  it("gap of exactly 15min = same session (inclusive boundary)", () => {
    const s = computeSessions([
      { attemptedAt: at(0),  topic: "a", timeSpent: null },
      { attemptedAt: at(15), topic: "b", timeSpent: null },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].attemptCount).toBe(2);
    expect(s[0].durationMin).toBe(15);
  });

  it("gap of 16min = new session (exclusive boundary)", () => {
    const s = computeSessions([
      { attemptedAt: at(0),  topic: "a", timeSpent: null },
      { attemptedAt: at(16), topic: "b", timeSpent: null },
    ]);
    expect(s).toHaveLength(2);
    expect(s[0].topics).toEqual(["a"]);
    expect(s[1].topics).toEqual(["b"]);
  });

  it("multi-attempt session tracks distinct topics in order", () => {
    const s = computeSessions([
      { attemptedAt: at(0),  topic: "kinetics",   timeSpent: null },
      { attemptedAt: at(5),  topic: "kinetics",   timeSpent: null },
      { attemptedAt: at(10), topic: "mechanism",  timeSpent: null },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].topics).toEqual(["kinetics", "mechanism"]);
    expect(s[0].attemptCount).toBe(3);
    expect(s[0].durationMin).toBe(10);
  });

  it("handles unsorted input defensively", () => {
    const out: AttemptPoint[] = [
      { attemptedAt: at(30), topic: "b", timeSpent: null },
      { attemptedAt: at(0),  topic: "a", timeSpent: null },
      { attemptedAt: at(10), topic: "a", timeSpent: null },
    ];
    const s = computeSessions(out);
    expect(s).toHaveLength(2); // gap 10→30 = 20 min = split
    expect(s[0].topics).toEqual(["a"]);
    expect(s[1].topics).toEqual(["b"]);
  });

  it("skips malformed timestamps without throwing", () => {
    const s = computeSessions([
      { attemptedAt: "not-a-date", topic: "x", timeSpent: null },
      { attemptedAt: at(0), topic: "a", timeSpent: null },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].topics).toEqual(["a"]);
  });

  it("respects custom maxGapMin", () => {
    const s = computeSessions(
      [
        { attemptedAt: at(0),  topic: "a", timeSpent: null },
        { attemptedAt: at(25), topic: "b", timeSpent: null },
      ],
      30
    );
    expect(s).toHaveLength(1);
  });
});

describe("computeSessionStats", () => {
  it("zero sessions → zeros and null avg", () => {
    const stats = computeSessionStats([], new Date("2026-04-22T12:00:00Z"));
    expect(stats).toEqual({
      todayMinutes: 0,
      last7dMinutes: 0,
      sessionsLast7d: 0,
      avgSessionDurationMin: null,
    });
  });

  it("rolls up today / week / avg", () => {
    const now = new Date("2026-04-22T23:00:00Z");
    const sessions = [
      // today: 2 sessions, 45 + 30 = 75min
      { startAt: "2026-04-22T08:00:00Z", endAt: "2026-04-22T08:45:00Z", durationMin: 45, attemptCount: 3, topics: ["a"] },
      { startAt: "2026-04-22T14:00:00Z", endAt: "2026-04-22T14:30:00Z", durationMin: 30, attemptCount: 2, topics: ["b"] },
      // yesterday: within 7d
      { startAt: "2026-04-21T10:00:00Z", endAt: "2026-04-21T10:50:00Z", durationMin: 50, attemptCount: 4, topics: ["c"] },
      // 10 days ago: outside 7d
      { startAt: "2026-04-12T10:00:00Z", endAt: "2026-04-12T10:30:00Z", durationMin: 30, attemptCount: 1, topics: ["d"] },
    ];
    const stats = computeSessionStats(sessions, now);
    expect(stats.todayMinutes).toBe(75);
    expect(stats.last7dMinutes).toBe(125); // 45+30+50
    expect(stats.sessionsLast7d).toBe(3);
    expect(stats.avgSessionDurationMin).toBe(42); // 125/3 rounded
  });
});
