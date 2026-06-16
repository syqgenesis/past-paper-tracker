// Pure-helper tests for the topic detail client: sort comparator + the
// formatAttemptDate slicer.

import { describe, it, expect } from "vitest";
import {
  compare,
  formatAttemptDate,
  matchesYear,
  matchesScoreBucket,
  matchesDateBucket,
  realAccuracy,
  type TopicDetailSortKey,
} from "@/app/topics/[slug]/topic-detail-client";
import type { TopicDetailRow } from "@/lib/analytics";

// Test factory — provide just the fields the sort uses; everything else is filler.
function row(overrides: Partial<TopicDetailRow>): TopicDetailRow {
  return {
    questionId: 0, paperId: 0, year: 2024, paperNumber: "1",
    questionNum: 1, maxMark: 20, qpPath: null, msPath: null,
    attemptId: 0, score: 10, attemptMaxMark: 20, confidence: 3,
    mistakeType: null, notes: null, markedForReview: false,
    attemptedAt: "2024-01-01 10:00:00",
    ...overrides,
  };
}

describe("compare (sort)", () => {
  describe("paper key", () => {
    it("sorts ascending by year first", () => {
      const cmp = compare(row({ year: 2023 }), row({ year: 2024 }), "paper");
      expect(cmp).toBeLessThan(0);
    });

    it("breaks year ties by paper number, then by question number", () => {
      // Same year, different paper number
      expect(compare(
        row({ year: 2024, paperNumber: "2A", questionNum: 1 }),
        row({ year: 2024, paperNumber: "2B", questionNum: 1 }),
        "paper",
      )).toBeLessThan(0);
      // Same year + paper, different question number
      expect(compare(
        row({ year: 2024, paperNumber: "1", questionNum: 2 }),
        row({ year: 2024, paperNumber: "1", questionNum: 5 }),
        "paper",
      )).toBeLessThan(0);
    });
  });

  describe("score key", () => {
    it("orders by accuracy ASC (weakest first when ascending)", () => {
      // 50% vs 80% → 50% sorts before 80%
      const cmp = compare(
        row({ score: 10, attemptMaxMark: 20 }),
        row({ score: 16, attemptMaxMark: 20 }),
        "score",
      );
      expect(cmp).toBeLessThan(0);
    });

    it("puts null scores last regardless of direction", () => {
      const withScore = row({ score: 10, attemptMaxMark: 20 });
      const nullScore = row({ attemptMaxMark: null });
      expect(compare(withScore, nullScore, "score")).toBeLessThan(0);
      expect(compare(nullScore, withScore, "score")).toBeGreaterThan(0);
    });

    it("handles two null-score rows as equal", () => {
      const a = row({ attemptMaxMark: null });
      const b = row({ attemptMaxMark: 0 });
      expect(compare(a, b, "score")).toBe(0);
    });
  });

  describe("confidence key", () => {
    it("orders ascending", () => {
      expect(compare(row({ confidence: 1 }), row({ confidence: 5 }), "confidence")).toBeLessThan(0);
    });

    it("puts nulls last", () => {
      expect(compare(row({ confidence: 3 }), row({ confidence: null }), "confidence")).toBeLessThan(0);
      expect(compare(row({ confidence: null }), row({ confidence: 3 }), "confidence")).toBeGreaterThan(0);
    });
  });

  describe("review key", () => {
    it("orders unflagged before flagged when ascending", () => {
      expect(compare(
        row({ markedForReview: false }),
        row({ markedForReview: true }),
        "review",
      )).toBeLessThan(0);
    });

    it("treats two same-flagged rows as equal", () => {
      expect(compare(
        row({ markedForReview: true }),
        row({ markedForReview: true }),
        "review",
      )).toBe(0);
    });
  });

  describe("attemptedAt key", () => {
    it("orders by ISO string ASC", () => {
      expect(compare(
        row({ attemptedAt: "2024-01-01 10:00:00" }),
        row({ attemptedAt: "2024-06-01 10:00:00" }),
        "attemptedAt",
      )).toBeLessThan(0);
    });

    it("matches lexicographic = chronological for the SQLite format", () => {
      // Same date, different times
      expect(compare(
        row({ attemptedAt: "2024-01-01 09:00:00" }),
        row({ attemptedAt: "2024-01-01 18:00:00" }),
        "attemptedAt",
      )).toBeLessThan(0);
    });
  });

  it("exhaustively covers all SortKey values without throwing", () => {
    const keys: TopicDetailSortKey[] = ["paper", "score", "confidence", "review", "attemptedAt"];
    for (const k of keys) {
      expect(() => compare(row({}), row({}), k)).not.toThrow();
    }
  });
});

describe("formatAttemptDate", () => {
  it("returns the YYYY-MM-DD prefix", () => {
    expect(formatAttemptDate("2024-03-15 09:42:18")).toBe("2024-03-15");
  });

  it("works for ISO 8601 with T separator", () => {
    expect(formatAttemptDate("2024-03-15T09:42:18Z")).toBe("2024-03-15");
  });
});

// ─── realAccuracy (strict null) ──────────────────────────────────────────────
// Regression coverage for the same bug-class flagged on getTopicDetail's avg —
// score=null must NOT compute as 0%. realAccuracy is the strict version used
// by both the sort and the score-bucket filter.

describe("realAccuracy", () => {
  it("returns the percentage for a scored attempt", () => {
    expect(realAccuracy(row({ score: 15, attemptMaxMark: 20 }))).toBe(75);
  });

  it("returns null when score is null", () => {
    expect(realAccuracy(row({ score: null, attemptMaxMark: 20 }))).toBeNull();
  });

  it("returns null when attemptMaxMark is missing or zero", () => {
    expect(realAccuracy(row({ score: 10, attemptMaxMark: null }))).toBeNull();
    expect(realAccuracy(row({ score: 10, attemptMaxMark: 0 }))).toBeNull();
  });

  it("preserves a genuine zero", () => {
    expect(realAccuracy(row({ score: 0, attemptMaxMark: 20 }))).toBe(0);
  });
});

// ─── matchesYear ─────────────────────────────────────────────────────────────

describe("matchesYear", () => {
  it("passes everything when filter is 'all'", () => {
    expect(matchesYear(row({ year: 2024 }), "all")).toBe(true);
    expect(matchesYear(row({ year: 2017 }), "all")).toBe(true);
  });

  it("does an exact year match", () => {
    expect(matchesYear(row({ year: 2024 }), 2024)).toBe(true);
    expect(matchesYear(row({ year: 2023 }), 2024)).toBe(false);
  });
});

// ─── matchesScoreBucket ──────────────────────────────────────────────────────

describe("matchesScoreBucket", () => {
  it("passes everything when bucket is 'all'", () => {
    expect(matchesScoreBucket(row({ score: 5, attemptMaxMark: 20 }), "all")).toBe(true);
    expect(matchesScoreBucket(row({ score: null, attemptMaxMark: 20 }), "all")).toBe(true);
  });

  describe("lt50 (< 50%)", () => {
    it("matches scores below 50%", () => {
      expect(matchesScoreBucket(row({ score: 9, attemptMaxMark: 20 }), "lt50")).toBe(true);   // 45%
      expect(matchesScoreBucket(row({ score: 0, attemptMaxMark: 20 }), "lt50")).toBe(true);   // 0%
    });
    it("excludes 50% exactly (boundary belongs to 'mid')", () => {
      expect(matchesScoreBucket(row({ score: 10, attemptMaxMark: 20 }), "lt50")).toBe(false); // 50%
    });
    it("excludes unscored rows", () => {
      expect(matchesScoreBucket(row({ score: null, attemptMaxMark: 20 }), "lt50")).toBe(false);
    });
  });

  describe("mid (50–75%)", () => {
    it("matches at 50% and below 75%", () => {
      expect(matchesScoreBucket(row({ score: 10, attemptMaxMark: 20 }), "mid")).toBe(true);  // 50%
      expect(matchesScoreBucket(row({ score: 14, attemptMaxMark: 20 }), "mid")).toBe(true);  // 70%
    });
    it("excludes 75% exactly (boundary belongs to 'gte75')", () => {
      expect(matchesScoreBucket(row({ score: 15, attemptMaxMark: 20 }), "mid")).toBe(false); // 75%
    });
    it("excludes <50%", () => {
      expect(matchesScoreBucket(row({ score: 9, attemptMaxMark: 20 }), "mid")).toBe(false);  // 45%
    });
  });

  describe("gte75 (≥ 75%)", () => {
    it("matches 75% and above", () => {
      expect(matchesScoreBucket(row({ score: 15, attemptMaxMark: 20 }), "gte75")).toBe(true);  // 75%
      expect(matchesScoreBucket(row({ score: 20, attemptMaxMark: 20 }), "gte75")).toBe(true);  // 100%
    });
    it("excludes below 75%", () => {
      expect(matchesScoreBucket(row({ score: 14, attemptMaxMark: 20 }), "gte75")).toBe(false); // 70%
    });
  });

  describe("unscored", () => {
    it("matches rows with null score", () => {
      expect(matchesScoreBucket(row({ score: null }), "unscored")).toBe(true);
    });
    it("excludes rows with any real score (including zero)", () => {
      expect(matchesScoreBucket(row({ score: 0, attemptMaxMark: 20 }), "unscored")).toBe(false);
      expect(matchesScoreBucket(row({ score: 15, attemptMaxMark: 20 }), "unscored")).toBe(false);
    });
  });
});

// ─── matchesDateBucket ───────────────────────────────────────────────────────
// Inject `now` so tests are deterministic.

describe("matchesDateBucket", () => {
  const NOW = Date.UTC(2026, 4, 20, 12, 0, 0); // 2026-05-20T12:00:00Z

  it("passes everything when bucket is 'all'", () => {
    expect(matchesDateBucket(row({ attemptedAt: "2020-01-01 00:00:00" }), "all", NOW)).toBe(true);
  });

  it("includes attempts inside the 7-day window", () => {
    expect(matchesDateBucket(row({ attemptedAt: "2026-05-19 12:00:00" }), "7d", NOW)).toBe(true);  // 1d ago
    expect(matchesDateBucket(row({ attemptedAt: "2026-05-13 13:00:00" }), "7d", NOW)).toBe(true);  // 6d 23h ago
  });

  it("excludes attempts older than 7 days from the 7-day window", () => {
    expect(matchesDateBucket(row({ attemptedAt: "2026-05-12 00:00:00" }), "7d", NOW)).toBe(false); // ~8d ago
  });

  it("respects the 30-day window", () => {
    expect(matchesDateBucket(row({ attemptedAt: "2026-04-25 12:00:00" }), "30d", NOW)).toBe(true);
    expect(matchesDateBucket(row({ attemptedAt: "2026-04-15 12:00:00" }), "30d", NOW)).toBe(false);
  });

  it("respects the 90-day window", () => {
    expect(matchesDateBucket(row({ attemptedAt: "2026-03-01 12:00:00" }), "90d", NOW)).toBe(true);
    expect(matchesDateBucket(row({ attemptedAt: "2026-01-15 12:00:00" }), "90d", NOW)).toBe(false);
  });

  it("treats the SQLite YYYY-MM-DD HH:MM:SS format as UTC", () => {
    // If the impl parsed without UTC, a near-cutoff attempt would land on the
    // wrong side depending on test-runner timezone.
    expect(matchesDateBucket(row({ attemptedAt: "2026-05-13 12:00:01" }), "7d", NOW)).toBe(true);
  });
});
