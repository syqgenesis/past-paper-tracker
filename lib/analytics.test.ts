/**
 * Unit tests for analytics query functions.
 * Uses an in-memory SQLite database seeded with test data.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

// We can't import getReviewQueue directly because it uses the singleton db.
// Instead, we'll test the SQL logic by creating an in-memory DB with the same schema
// and running the query through drizzle directly.

let testDb: ReturnType<typeof drizzle>;

beforeAll(() => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE papers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      year         INTEGER NOT NULL,
      paper_number TEXT NOT NULL,
      qp_path      TEXT,
      ms_path      TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(year, paper_number)
    );

    CREATE TABLE questions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id     INTEGER NOT NULL REFERENCES papers(id),
      question_num INTEGER NOT NULL,
      topic        TEXT,
      subtopic     TEXT,
      max_mark     INTEGER,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(paper_id, question_num)
    );

    CREATE TABLE attempts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id      INTEGER NOT NULL REFERENCES questions(id),
      status           TEXT NOT NULL DEFAULT 'attempted',
      score            REAL,
      max_mark         REAL,
      confidence       INTEGER,
      mistake_type     TEXT,
      notes            TEXT,
      marked_for_review INTEGER DEFAULT 0,
      time_spent       INTEGER,
      attempted_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_attempts_question_date
      ON attempts(question_id, attempted_at DESC);
  `);

  // Seed data
  sqlite.exec(`
    INSERT INTO papers (id, year, paper_number) VALUES (1, 2024, '1');
    INSERT INTO papers (id, year, paper_number) VALUES (2, 2024, '2A');
    INSERT INTO papers (id, year, paper_number) VALUES (3, 2023, '3');

    INSERT INTO questions (id, paper_id, question_num, topic, max_mark) VALUES (1, 1, 1, 'Thermodynamics', 10);
    INSERT INTO questions (id, paper_id, question_num, topic, max_mark) VALUES (2, 1, 2, 'Kinetics', 15);
    INSERT INTO questions (id, paper_id, question_num, topic, max_mark) VALUES (3, 2, 1, 'Organic', 20);
    INSERT INTO questions (id, paper_id, question_num, topic, max_mark) VALUES (4, 3, 1, 'Thermodynamics', 10);
    INSERT INTO questions (id, paper_id, question_num, topic, max_mark) VALUES (5, 3, 2, NULL, 10);

    -- Q1: two attempts, latest is marked for review
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, mistake_type, notes, marked_for_review, attempted_at)
      VALUES (1, 1, 'attempted', 3, 10, 2, 'conceptual', 'Missed entropy term', 1, '2024-01-01 10:00:00');
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, mistake_type, notes, marked_for_review, attempted_at)
      VALUES (2, 1, 'review_needed', 4, 10, 2, 'conceptual', 'Still struggling', 1, '2024-01-15 10:00:00');

    -- Q2: latest attempt marked for review, different mistake type
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, mistake_type, marked_for_review, attempted_at)
      VALUES (3, 2, 'review_needed', 5, 15, 3, 'calculation', 1, '2024-01-10 10:00:00');

    -- Q3: NOT marked for review
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, marked_for_review, attempted_at)
      VALUES (4, 3, 'completed', 18, 20, 5, 0, '2024-01-05 10:00:00');

    -- Q4: marked for review, thermodynamics topic (different year)
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, mistake_type, marked_for_review, attempted_at)
      VALUES (5, 4, 'review_needed', 3, 10, 1, 'forgot_formula', 1, '2024-01-20 10:00:00');

    -- Q5: marked for review, null topic
    INSERT INTO attempts (id, question_id, status, score, max_mark, confidence, marked_for_review, attempted_at)
      VALUES (6, 5, 'review_needed', 2, 10, 1, 1, '2024-01-25 10:00:00');
  `);

  testDb = drizzle(sqlite, { schema });
});

// Helper: run getReviewQueue logic on test DB
import { sql } from "drizzle-orm";

function queryReviewQueue(
  db: ReturnType<typeof drizzle>,
  filters?: { topic?: string; year?: number; paperNumber?: string; mistakeType?: string }
) {
  const conditions = [
    sql`a.marked_for_review = 1`,
    sql`a.id IN (SELECT id FROM attempts a2 WHERE a2.question_id = a.question_id ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1)`,
  ];
  if (filters?.topic)       conditions.push(sql`LOWER(q.topic) = LOWER(${filters.topic})`);
  if (filters?.year)        conditions.push(sql`p.year = ${filters.year}`);
  if (filters?.paperNumber) conditions.push(sql`p.paper_number = ${filters.paperNumber}`);
  if (filters?.mistakeType) conditions.push(sql`a.mistake_type = ${filters.mistakeType}`);

  const where = conditions.reduce((acc, cond, i) =>
    i === 0 ? cond : sql`${acc} AND ${cond}`
  );

  return db.all<{
    attemptId: number; questionId: number; questionNum: number; paperId: number;
    year: number; paperNumber: string; topic: string | null;
    score: number | null; maxMark: number | null; confidence: number | null;
    mistakeType: string | null; notes: string | null; attemptedAt: string;
  }>(sql`
    SELECT
      a.id         AS attemptId,
      q.id         AS questionId,
      q.question_num AS questionNum,
      q.paper_id   AS paperId,
      p.year       AS year,
      p.paper_number AS paperNumber,
      q.topic      AS topic,
      a.score      AS score,
      a.max_mark   AS maxMark,
      a.confidence AS confidence,
      a.mistake_type AS mistakeType,
      a.notes      AS notes,
      a.attempted_at AS attemptedAt
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    JOIN papers p    ON p.id = q.paper_id
    WHERE ${where}
    ORDER BY a.attempted_at ASC
  `);
}

describe("getReviewQueue", () => {
  it("returns all flagged items with attemptId when no filters", () => {
    const items = queryReviewQueue(testDb);
    // Q1 (latest attempt #2), Q2 (attempt #3), Q4 (attempt #5), Q5 (attempt #6)
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.attemptId != null)).toBe(true);
  });

  it("only returns the latest attempt per question", () => {
    const items = queryReviewQueue(testDb);
    // Q1 has two attempts (1 and 2) — should only return attempt 2
    const q1 = items.find((i) => i.questionId === 1);
    expect(q1).toBeDefined();
    expect(q1!.attemptId).toBe(2);
    expect(q1!.notes).toBe("Still struggling");
  });

  it("excludes items not marked for review", () => {
    const items = queryReviewQueue(testDb);
    // Q3 (attempt #4) is marked_for_review=0
    expect(items.find((i) => i.questionId === 3)).toBeUndefined();
  });

  it("filters by topic", () => {
    const items = queryReviewQueue(testDb, { topic: "thermodynamics" });
    expect(items).toHaveLength(2); // Q1 and Q4 both have Thermodynamics
    expect(items.every((i) => i.topic?.toLowerCase() === "thermodynamics")).toBe(true);
  });

  it("filters by year", () => {
    const items = queryReviewQueue(testDb, { year: 2023 });
    expect(items).toHaveLength(2); // Q4 and Q5 are in 2023 paper
    expect(items.every((i) => i.year === 2023)).toBe(true);
  });

  it("filters by paper number", () => {
    const items = queryReviewQueue(testDb, { paperNumber: "1" });
    // Paper 1 has Q1 and Q2
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.paperNumber === "1")).toBe(true);
  });

  it("filters by mistake type", () => {
    const items = queryReviewQueue(testDb, { mistakeType: "conceptual" });
    expect(items).toHaveLength(1);
    expect(items[0].mistakeType).toBe("conceptual");
  });

  it("combines multiple filters", () => {
    const items = queryReviewQueue(testDb, { topic: "thermodynamics", year: 2024 });
    expect(items).toHaveLength(1);
    expect(items[0].questionId).toBe(1);
  });

  it("returns empty array when no items match", () => {
    const items = queryReviewQueue(testDb, { topic: "nonexistent" });
    expect(items).toHaveLength(0);
  });

  it("handles special characters in filter values (parameterized SQL)", () => {
    // This should not crash — parameterized queries handle quotes safely
    const items = queryReviewQueue(testDb, { topic: "Hess's Law" });
    expect(items).toHaveLength(0); // No match, but no SQL injection
  });

  it("sorts results by attempted_at ASC (oldest first)", () => {
    const items = queryReviewQueue(testDb);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].attemptedAt >= items[i - 1].attemptedAt).toBe(true);
    }
  });

  it("includes items with null topic", () => {
    const items = queryReviewQueue(testDb);
    const nullTopic = items.find((i) => i.topic === null);
    expect(nullTopic).toBeDefined();
    expect(nullTopic!.questionId).toBe(5);
  });
});

// ─── slugifyTopic ────────────────────────────────────────────────────────────

import { slugifyTopic } from "@/lib/analytics";

describe("slugifyTopic", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugifyTopic("Thermodynamics")).toBe("thermodynamics");
    expect(slugifyTopic("MO Theory")).toBe("mo-theory");
  });

  it("expands ampersands to 'and'", () => {
    expect(slugifyTopic("Acids & Bases")).toBe("acids-and-bases");
  });

  it("strips apostrophes and other punctuation", () => {
    expect(slugifyTopic("Hess's Law")).toBe("hess-s-law");
    expect(slugifyTopic("Group 1, 2 chemistry")).toBe("group-1-2-chemistry");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugifyTopic("Foo   ---   Bar")).toBe("foo-bar");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugifyTopic("  -- foo --  ")).toBe("foo");
  });
});

// ─── resolveSlug ─────────────────────────────────────────────────────────────
// resolveSlug() in production hits the singleton db via getDistinctTopics().
// The logic itself is "find a topic whose slug matches", so we exercise the
// resolution logic with a known topic list (passed in) rather than the live DB.

function resolveAgainst(topics: string[], slug: string): string | null {
  return topics.find((t) => slugifyTopic(t) === slug) ?? null;
}

describe("resolveSlug (resolution logic)", () => {
  const topics = ["Thermodynamics", "Acids & Bases", "MO Theory", "Hess's Law"];

  it("returns the original topic name when slug matches", () => {
    expect(resolveAgainst(topics, "thermodynamics")).toBe("Thermodynamics");
    expect(resolveAgainst(topics, "mo-theory")).toBe("MO Theory");
  });

  it("matches slugs containing 'and' (from &)", () => {
    expect(resolveAgainst(topics, "acids-and-bases")).toBe("Acids & Bases");
  });

  it("matches slugs whose source had apostrophes", () => {
    // "Hess's Law" → "hess-s-law" per slugifyTopic
    expect(resolveAgainst(topics, "hess-s-law")).toBe("Hess's Law");
  });

  it("returns null for an unknown slug", () => {
    expect(resolveAgainst(topics, "kinetics")).toBeNull();
    expect(resolveAgainst(topics, "")).toBeNull();
  });

  it("returns null when the topic list is empty", () => {
    expect(resolveAgainst([], "anything")).toBeNull();
  });

  it("on collision, returns the first match (documented behaviour)", () => {
    // Both slugify to "acids-and-bases" — first one wins.
    const colliding = ["Acids & Bases", "Acids and Bases"];
    expect(resolveAgainst(colliding, "acids-and-bases")).toBe("Acids & Bases");
  });

  it("slug match is exact (case-sensitive on the slug side)", () => {
    // Slugs are always lowercase by construction; an uppercase slug never matches.
    expect(resolveAgainst(topics, "Thermodynamics")).toBeNull();
  });
});

// ─── getTopicDetail accuracy: null score must NOT pull avg toward 0 ─────────
// Regression test for the bug where `score ?? 0` silently treated unscored
// attempts as 0%, dragging the topic accuracy down.

describe("getTopicDetail accuracy — null-score handling", () => {
  function computeAvg(rows: Array<{ maxMark: number | null; score: number | null; attemptMaxMark: number | null }>): number | null {
    // Mirrors the production logic in getTopicDetail().
    const accuracies = rows
      .filter((q) => q.maxMark != null && q.maxMark > 5)
      .map((q) => {
        if (q.score == null) return null;
        if (q.attemptMaxMark == null || q.attemptMaxMark <= 0) return null;
        return (q.score / q.attemptMaxMark) * 100;
      })
      .filter((a): a is number => a != null);
    return accuracies.length > 0
      ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
      : null;
  }

  it("excludes rows where score is null instead of treating them as 0", () => {
    // Without the fix: avg would be (75 + 0) / 2 = 37.5%, rounded 38.
    // With the fix: only the scored row counts → 75%.
    expect(computeAvg([
      { maxMark: 20, score: 15, attemptMaxMark: 20 },
      { maxMark: 20, score: null, attemptMaxMark: 20 },
    ])).toBe(75);
  });

  it("returns null when every row has a null score", () => {
    expect(computeAvg([
      { maxMark: 20, score: null, attemptMaxMark: 20 },
      { maxMark: 20, score: null, attemptMaxMark: 20 },
    ])).toBeNull();
  });

  it("still treats a real zero as 0%", () => {
    // 0 is a meaningful score — distinguish from null.
    expect(computeAvg([
      { maxMark: 20, score: 0,  attemptMaxMark: 20 },
      { maxMark: 20, score: 20, attemptMaxMark: 20 },
    ])).toBe(50);
  });

  it("excludes rows where attemptMaxMark is missing or zero", () => {
    expect(computeAvg([
      { maxMark: 20, score: 10, attemptMaxMark: null },
      { maxMark: 20, score: 10, attemptMaxMark: 0 },
      { maxMark: 20, score: 15, attemptMaxMark: 20 },
    ])).toBe(75);
  });

  it("still excludes ≤5-mark questions even when score is recorded", () => {
    // 5-mark row scored perfect; if filter slipped it would be (75 + 100) / 2 = 87.5.
    expect(computeAvg([
      { maxMark: 20, score: 15, attemptMaxMark: 20 },
      { maxMark: 5,  score: 5,  attemptMaxMark: 5  },
    ])).toBe(75);
  });
});

// ─── getTopicIndex ───────────────────────────────────────────────────────────

function queryTopicIndex(db: ReturnType<typeof drizzle>) {
  return db.all<{
    topic:             string;
    totalQuestions:    number;
    attemptedQuestions: number;
    avgAccuracy:       number | null;
    reviewCount:       number;
    lastAttempted:     string | null;
  }>(sql`
    WITH latest_attempt AS (
      SELECT a.*
      FROM attempts a
      WHERE a.id IN (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC
        LIMIT 1
      )
    )
    SELECT
      q.topic                                                            AS topic,
      COUNT(DISTINCT q.id)                                               AS totalQuestions,
      COUNT(DISTINCT la.question_id)                                     AS attemptedQuestions,
      AVG(
        CASE WHEN la.max_mark > 0 AND q.max_mark > 5
             THEN CAST(la.score AS REAL) / la.max_mark * 100
             ELSE NULL END
      )                                                                  AS avgAccuracy,
      COUNT(DISTINCT CASE WHEN la.marked_for_review = 1
                          THEN la.question_id END)                       AS reviewCount,
      MAX(la.attempted_at)                                               AS lastAttempted
    FROM questions q
    LEFT JOIN latest_attempt la ON la.question_id = q.id
    WHERE q.topic IS NOT NULL AND q.topic != ''
    GROUP BY q.topic
    ORDER BY q.topic ASC
  `);
}

describe("getTopicIndex (SQL aggregation)", () => {
  it("returns one row per distinct topic (null topics excluded)", () => {
    const rows = queryTopicIndex(testDb);
    const topics = rows.map((r) => r.topic).sort();
    // Seed: Thermodynamics (×2), Kinetics, Organic, NULL — expect 3 distinct named topics
    expect(topics).toEqual(["Kinetics", "Organic", "Thermodynamics"]);
  });

  it("totalQuestions counts all questions on a topic regardless of attempts", () => {
    const thermo = queryTopicIndex(testDb).find((r) => r.topic === "Thermodynamics");
    expect(thermo!.totalQuestions).toBe(2); // Q1 + Q4
  });

  it("attemptedQuestions counts only those with at least one attempt", () => {
    const thermo = queryTopicIndex(testDb).find((r) => r.topic === "Thermodynamics");
    expect(thermo!.attemptedQuestions).toBe(2); // both Q1 and Q4 attempted
  });

  it("avgAccuracy averages the LATEST attempt's accuracy per question", () => {
    const thermo = queryTopicIndex(testDb).find((r) => r.topic === "Thermodynamics");
    // Q1 latest: 4/10 = 40%, Q4 latest: 3/10 = 30% → avg 35%
    expect(thermo!.avgAccuracy).toBeCloseTo(35, 0);
  });

  it("reviewCount counts distinct questions whose latest attempt is flagged", () => {
    const thermo = queryTopicIndex(testDb).find((r) => r.topic === "Thermodynamics");
    expect(thermo!.reviewCount).toBe(2); // both Q1 and Q4 flagged on latest attempt
    const organic = queryTopicIndex(testDb).find((r) => r.topic === "Organic");
    expect(organic!.reviewCount).toBe(0); // Q3 not flagged
  });

  it("lastAttempted is the most recent attempted_at across the topic", () => {
    const thermo = queryTopicIndex(testDb).find((r) => r.topic === "Thermodynamics");
    expect(thermo!.lastAttempted).toBe("2024-01-20 10:00:00"); // Q4 attempt is newer
  });

  it("avgAccuracy is null for topics with no attempts", () => {
    // Add an unattempted topic to test the null branch
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE papers (id INTEGER PRIMARY KEY, year INTEGER, paper_number TEXT);
      CREATE TABLE questions (id INTEGER PRIMARY KEY, paper_id INTEGER, question_num INTEGER, topic TEXT, max_mark INTEGER);
      CREATE TABLE attempts (id INTEGER PRIMARY KEY, question_id INTEGER, score REAL, max_mark REAL, marked_for_review INTEGER, attempted_at TEXT);
      INSERT INTO papers VALUES (1, 2024, '1');
      INSERT INTO questions VALUES (1, 1, 1, 'Untouched', 10);
    `);
    const empty = drizzle(sqlite, { schema });
    const row = queryTopicIndex(empty).find((r) => r.topic === "Untouched");
    expect(row!.attemptedQuestions).toBe(0);
    expect(row!.avgAccuracy).toBeNull();
    expect(row!.reviewCount).toBe(0);
  });
});

// ─── getTopicDetail ──────────────────────────────────────────────────────────

function queryTopicDetail(db: ReturnType<typeof drizzle>, topic: string) {
  return db.all<{
    questionId: number; paperId: number; year: number; paperNumber: string;
    questionNum: number; maxMark: number | null;
    qpPath: string | null; msPath: string | null;
    attemptId: number; score: number | null; attemptMaxMark: number | null;
    confidence: number | null; mistakeType: string | null; notes: string | null;
    markedForReviewInt: number; attemptedAt: string;
  }>(sql`
    SELECT
      q.id            AS questionId,
      q.paper_id      AS paperId,
      p.year          AS year,
      p.paper_number  AS paperNumber,
      q.question_num  AS questionNum,
      q.max_mark      AS maxMark,
      p.qp_path       AS qpPath,
      p.ms_path       AS msPath,
      a.id            AS attemptId,
      a.score         AS score,
      a.max_mark      AS attemptMaxMark,
      a.confidence    AS confidence,
      a.mistake_type  AS mistakeType,
      a.notes         AS notes,
      a.marked_for_review AS markedForReviewInt,
      a.attempted_at  AS attemptedAt
    FROM questions q
    JOIN papers p ON p.id = q.paper_id
    JOIN attempts a ON a.question_id = q.id
    WHERE LOWER(q.topic) = LOWER(${topic})
      AND a.id IN (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC
        LIMIT 1
      )
    ORDER BY p.year DESC, p.paper_number ASC, q.question_num ASC
  `);
}

describe("getTopicDetail (SQL)", () => {
  it("returns one row per attempted question on the topic (latest attempt)", () => {
    const rows = queryTopicDetail(testDb, "Thermodynamics");
    expect(rows).toHaveLength(2);
    const q1 = rows.find((r) => r.questionId === 1);
    // Q1 had two attempts (1, 2) — we should see attempt 2 (latest)
    expect(q1!.attemptId).toBe(2);
    expect(q1!.notes).toBe("Still struggling");
  });

  it("matches topic case-insensitively", () => {
    expect(queryTopicDetail(testDb, "thermodynamics")).toHaveLength(2);
    expect(queryTopicDetail(testDb, "THERMODYNAMICS")).toHaveLength(2);
  });

  it("returns empty array for a topic with no attempts", () => {
    expect(queryTopicDetail(testDb, "Nonexistent")).toHaveLength(0);
  });

  it("orders by year DESC then paper_number ASC then question_num ASC", () => {
    const rows = queryTopicDetail(testDb, "Thermodynamics");
    // 2024 P1 Q1 should come before 2023 P3 Q1
    expect(rows[0].year).toBe(2024);
    expect(rows[1].year).toBe(2023);
  });

  it("exposes markedForReview as the raw int (1/0) — caller converts to boolean", () => {
    const rows = queryTopicDetail(testDb, "Thermodynamics");
    expect(rows.every((r) => r.markedForReviewInt === 1)).toBe(true);
    const organic = queryTopicDetail(testDb, "Organic");
    expect(organic[0].markedForReviewInt).toBe(0);
  });
});

// ─── 5-mark exclusion ────────────────────────────────────────────────────────
// ≤5-mark questions are shown in the table and counted in `attempted`, but
// they don't carry weight toward the grade so they MUST NOT skew the avg.

describe("≤5-mark question exclusion", () => {
  function setupMixedMarks() {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE papers (id INTEGER PRIMARY KEY, year INTEGER, paper_number TEXT, qp_path TEXT, ms_path TEXT);
      CREATE TABLE questions (id INTEGER PRIMARY KEY, paper_id INTEGER, question_num INTEGER, topic TEXT, max_mark INTEGER);
      CREATE TABLE attempts (id INTEGER PRIMARY KEY, question_id INTEGER, score REAL, max_mark REAL, confidence INTEGER, mistake_type TEXT, notes TEXT, marked_for_review INTEGER, attempted_at TEXT);
      INSERT INTO papers VALUES (1, 2024, '1', '/qp.pdf', '/ms.pdf');
      -- Two big questions worth 20 marks each — these should count.
      INSERT INTO questions VALUES (1, 1, 1, 'Mixed', 20);
      INSERT INTO questions VALUES (2, 1, 2, 'Mixed', 20);
      -- Two short throwaways worth 5 and 3 marks — must NOT count toward avg.
      INSERT INTO questions VALUES (3, 1, 3, 'Mixed', 5);
      INSERT INTO questions VALUES (4, 1, 4, 'Mixed', 3);
      -- Latest attempts: big questions average 75%, short ones perfect 100%.
      -- If 5-mark rule fires, avg should be 75% (not 87.5%).
      INSERT INTO attempts VALUES (1, 1, 18, 20, 3, NULL, NULL, 0, '2024-01-01');
      INSERT INTO attempts VALUES (2, 2, 12, 20, 3, NULL, NULL, 0, '2024-01-02');
      INSERT INTO attempts VALUES (3, 3,  5,  5, 5, NULL, NULL, 0, '2024-01-03');
      INSERT INTO attempts VALUES (4, 4,  3,  3, 5, NULL, NULL, 0, '2024-01-04');
    `);
    return drizzle(sqlite, { schema });
  }

  it("getTopicIndex excludes ≤5-mark questions from avgAccuracy", () => {
    const db = setupMixedMarks();
    const row = queryTopicIndex(db).find((r) => r.topic === "Mixed");
    // (18/20 + 12/20) / 2 = 75. If short Qs were included, would be ~87.5.
    expect(row!.avgAccuracy).toBeCloseTo(75, 0);
  });

  it("getTopicIndex still counts ≤5-mark questions in totalQuestions/attemptedQuestions", () => {
    const db = setupMixedMarks();
    const row = queryTopicIndex(db).find((r) => r.topic === "Mixed");
    // All 4 questions are visible — only the avg ignores small ones.
    expect(row!.totalQuestions).toBe(4);
    expect(row!.attemptedQuestions).toBe(4);
  });

  it("getTopicDetail returns all attempts but caller-side avg excludes ≤5-mark", () => {
    const db = setupMixedMarks();
    const rows = queryTopicDetail(db, "Mixed");
    expect(rows).toHaveLength(4); // all attempts visible in the table

    // Replicate the summary logic from getTopicDetail() — exclude q.maxMark ≤ 5.
    const accuracies = rows
      .filter((r) => r.maxMark != null && r.maxMark > 5)
      .map((r) => (r.attemptMaxMark && r.attemptMaxMark > 0
        ? (r.score ?? 0) / r.attemptMaxMark * 100
        : null))
      .filter((a): a is number => a != null);
    const avg = accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
    expect(avg).toBeCloseTo(75, 0);
  });

  it("avgAccuracy is null when all of a topic's questions are ≤5 marks", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE papers (id INTEGER PRIMARY KEY, year INTEGER, paper_number TEXT);
      CREATE TABLE questions (id INTEGER PRIMARY KEY, paper_id INTEGER, question_num INTEGER, topic TEXT, max_mark INTEGER);
      CREATE TABLE attempts (id INTEGER PRIMARY KEY, question_id INTEGER, score REAL, max_mark REAL, marked_for_review INTEGER, attempted_at TEXT);
      INSERT INTO papers VALUES (1, 2024, '1');
      INSERT INTO questions VALUES (1, 1, 1, 'TinyOnly', 5);
      INSERT INTO attempts VALUES (1, 1, 5, 5, 0, '2024-01-01');
    `);
    const db = drizzle(sqlite, { schema });
    const row = queryTopicIndex(db).find((r) => r.topic === "TinyOnly");
    expect(row!.attemptedQuestions).toBe(1); // still visible
    expect(row!.avgAccuracy).toBeNull();      // but contributes nothing to avg
  });

  // Replicates the getDashboardStats overall-accuracy expression. The dashboard
  // headline must apply the same ≤5-mark exclusion as the per-topic views.
  function queryOverallAccuracy(db: ReturnType<typeof drizzle>): number | null {
    const row = db.get<{ avgAccuracy: number | null }>(sql`
      SELECT AVG(
        CASE WHEN a.max_mark > 0 AND q.max_mark > 5
             THEN CAST(a.score AS REAL) / a.max_mark * 100
             ELSE NULL END
      ) AS avgAccuracy
      FROM attempts a
      JOIN questions q ON q.id = a.question_id
      WHERE a.id IN (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1
      )
    `);
    return row?.avgAccuracy ?? null;
  }

  it("getDashboardStats overall accuracy excludes ≤5-mark questions", () => {
    const db = setupMixedMarks();
    // Big Qs average 75%; the two perfect short Qs (5- and 3-mark) must be
    // ignored, else the headline would read ~87.5%.
    expect(queryOverallAccuracy(db)).toBeCloseTo(75, 0);
  });
});
