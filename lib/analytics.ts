// server-only: all analytics queries run server-side
import "server-only";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalQuestionsAttempted: number;
  totalPapersTouched:      number;
  overallAccuracy:         number | null;  // 0–100, null if no data
  avgConfidence:           number | null;  // 1–5, null if no data
}

export interface TopicAccuracy {
  topic:         string;
  count:         number;
  avgAccuracy:   number | null;
  avgConfidence: number | null;
}

export interface ColdTopic {
  topic:        string;
  lastAttempted: string;  // ISO date string
  daysSince:    number;
}

export interface ActivityEntry {
  date:     string;
  count:    number;
}

export interface WeakTopic {
  topic:       string;
  avgAccuracy: number;
  count:       number;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function getDashboardStats(): DashboardStats {
  const row = db.get<{
    totalAttempted: number;
    totalPapers:    number;
    avgAccuracy:    number | null;
    avgConfidence:  number | null;
  }>(sql`
    SELECT
      COUNT(DISTINCT a.question_id)                                    AS totalAttempted,
      COUNT(DISTINCT q.paper_id)                                       AS totalPapers,
      -- Exclude ≤5-mark questions from accuracy: they don't count toward the
      -- grade, so a perfect 5-marker must not inflate the headline figure.
      AVG(
        CASE WHEN a.max_mark > 0 AND q.max_mark > 5
             THEN CAST(a.score AS REAL) / a.max_mark * 100
             ELSE NULL END
      )                                                                AS avgAccuracy,
      AVG(a.confidence)                                                AS avgConfidence
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE a.id IN (
      SELECT id FROM attempts a2
      WHERE a2.question_id = a.question_id
      ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1
    )
  `);

  return {
    totalQuestionsAttempted: row?.totalAttempted ?? 0,
    totalPapersTouched:      row?.totalPapers ?? 0,
    overallAccuracy:         row?.avgAccuracy != null ? Math.round(row.avgAccuracy) : null,
    avgConfidence:           row?.avgConfidence != null ? Math.round(row.avgConfidence * 10) / 10 : null,
  };
}

// ─── Accuracy by Topic ────────────────────────────────────────────────────────

export function getAccuracyByTopic(): TopicAccuracy[] {
  return db.all<TopicAccuracy>(sql`
    SELECT
      LOWER(q.topic)                                                   AS topic,
      COUNT(*)                                                         AS count,
      -- Exclude ≤5-mark questions from accuracy (see getDashboardStats).
      AVG(
        CASE WHEN a.max_mark > 0 AND q.max_mark > 5
             THEN CAST(a.score AS REAL) / a.max_mark * 100
             ELSE NULL END
      )                                                                AS avgAccuracy,
      AVG(a.confidence)                                                AS avgConfidence
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE q.topic IS NOT NULL
      AND a.id IN (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1
      )
    GROUP BY LOWER(q.topic)
    ORDER BY avgAccuracy ASC NULLS LAST
  `);
}

// ─── Cold Topics ──────────────────────────────────────────────────────────────
// Topics not attempted in the last N days

export function getColdTopics(thresholdDays = 7): ColdTopic[] {
  return db.all<ColdTopic>(sql`
    SELECT
      LOWER(q.topic)                                AS topic,
      MAX(a.attempted_at)                           AS lastAttempted,
      CAST(
        (julianday('now') - julianday(MAX(a.attempted_at)))
        AS INTEGER
      )                                             AS daysSince
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE q.topic IS NOT NULL
    GROUP BY LOWER(q.topic)
    HAVING daysSince >= ${thresholdDays}
    ORDER BY daysSince DESC
  `);
}

// ─── Activity Over Time ───────────────────────────────────────────────────────
// Number of questions attempted per day over the last 30 days

export function getActivityOverTime(days = 30): ActivityEntry[] {
  return db.all<ActivityEntry>(sql`
    SELECT
      DATE(attempted_at) AS date,
      COUNT(*)           AS count
    FROM attempts
    WHERE attempted_at >= datetime('now', ${`-${days} days`})
    GROUP BY DATE(attempted_at)
    ORDER BY date ASC
  `);
}

// ─── Weak Topics ─────────────────────────────────────────────────────────────
// Topics with average accuracy below threshold

export function getWeakTopics(accuracyThreshold = 60): WeakTopic[] {
  return db.all<WeakTopic>(sql`
    SELECT
      LOWER(q.topic)                                                AS topic,
      COUNT(*)                                                      AS count,
      -- Exclude ≤5-mark questions from accuracy (see getDashboardStats).
      AVG(
        CASE WHEN a.max_mark > 0 AND q.max_mark > 5
             THEN CAST(a.score AS REAL) / a.max_mark * 100
             ELSE NULL END
      )                                                             AS avgAccuracy
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE q.topic IS NOT NULL
      AND a.id IN (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1
      )
    GROUP BY LOWER(q.topic)
    HAVING avgAccuracy IS NOT NULL AND avgAccuracy < ${accuracyThreshold}
    ORDER BY avgAccuracy ASC
    LIMIT 10
  `);
}

// ─── Distinct Topics ─────────────────────────────────────────────────────────

export function getDistinctTopics(): string[] {
  const rows = db.all<{ topic: string }>(sql`
    SELECT DISTINCT topic
    FROM questions
    WHERE topic IS NOT NULL AND topic != ''
    ORDER BY topic ASC
  `);
  return rows.map((r) => r.topic);
}

// ─── Topic Slugs ─────────────────────────────────────────────────────────────
// Topics are free-text; slugs are derived for URL routing.
// `&` → `and` so "Acids & Bases" → "acids-and-bases" (more readable than "acids-bases").
// Two distinct topics that slugify to the same string collide on resolveSlug;
// in practice topics are author-controlled and few enough that collisions are
// not expected. If one ever happens, resolveSlug returns the first match.

export function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveSlug(slug: string): string | null {
  const topics = getDistinctTopics();
  return topics.find((t) => slugifyTopic(t) === slug) ?? null;
}

// ─── Topic Index ─────────────────────────────────────────────────────────────
// One row per topic that has at least one question. Used by the /topics page.

export interface TopicIndexRow {
  topic:         string;
  slug:          string;
  totalQuestions:    number;
  attemptedQuestions: number;
  avgAccuracy:   number | null;  // 0–100, computed over latest attempts only
  reviewCount:   number;          // # of questions whose latest attempt is flagged
  lastAttempted: string | null;   // ISO datetime of most recent attempt
}

export function getTopicIndex(): TopicIndexRow[] {
  const rows = db.all<{
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
      -- Exclude ≤5-mark questions from accuracy: they don't count toward the grade.
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

  return rows.map((r) => ({
    topic:              r.topic,
    slug:               slugifyTopic(r.topic),
    totalQuestions:     r.totalQuestions,
    attemptedQuestions: r.attemptedQuestions,
    avgAccuracy:        r.avgAccuracy != null ? Math.round(r.avgAccuracy) : null,
    reviewCount:        r.reviewCount,
    lastAttempted:      r.lastAttempted,
  }));
}

// ─── Topic Detail ────────────────────────────────────────────────────────────
// All ATTEMPTED questions on a given topic, with their latest attempt's data.
// Used by /topics/[slug]. Topic match is case-insensitive to align with the
// rest of the analytics layer.

export interface TopicDetailRow {
  questionId:      number;
  paperId:         number;
  year:            number;
  paperNumber:     string;
  questionNum:     number;
  maxMark:         number | null;
  qpPath:          string | null;
  msPath:          string | null;
  attemptId:       number;
  score:           number | null;
  attemptMaxMark:  number | null;
  confidence:      number | null;
  mistakeType:     string | null;
  notes:           string | null;
  markedForReview: boolean;
  attemptedAt:     string;
}

export interface TopicDetailSummary {
  topic:              string;
  totalQuestions:     number;
  attemptedQuestions: number;
  avgAccuracy:        number | null;
  reviewCount:        number;
}

export interface TopicDetail {
  summary:   TopicDetailSummary;
  questions: TopicDetailRow[];
}

export function getTopicDetail(topic: string): TopicDetail {
  const rows = db.all<TopicDetailRow & { markedForReviewInt: number }>(sql`
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

  const questions: TopicDetailRow[] = rows.map((r) => ({
    questionId:      r.questionId,
    paperId:         r.paperId,
    year:            r.year,
    paperNumber:     r.paperNumber,
    questionNum:     r.questionNum,
    maxMark:         r.maxMark,
    qpPath:          r.qpPath,
    msPath:          r.msPath,
    attemptId:       r.attemptId,
    score:           r.score,
    attemptMaxMark:  r.attemptMaxMark,
    confidence:      r.confidence,
    mistakeType:     r.mistakeType,
    notes:           r.notes,
    markedForReview: r.markedForReviewInt === 1,
    attemptedAt:     r.attemptedAt,
  }));

  // Total questions on this topic (including unattempted) — used to show coverage
  // in the summary header even though the table itself only lists attempted ones.
  const totalRow = db.get<{ total: number }>(sql`
    SELECT COUNT(*) AS total
    FROM questions
    WHERE LOWER(topic) = LOWER(${topic})
  `);
  const totalQuestions = totalRow?.total ?? 0;

  // ≤5-mark questions are shown in the table but don't count toward the avg
  // (they don't carry weight toward the grade). A null score also excludes
  // the question — score=null means "I attempted but didn't grade it", not
  // "I scored zero", so it must not pull the average toward 0.
  const accuracies = questions
    .filter((q) => q.maxMark != null && q.maxMark > 5)
    .map((q) => {
      if (q.score == null) return null;
      if (q.attemptMaxMark == null || q.attemptMaxMark <= 0) return null;
      return (q.score / q.attemptMaxMark) * 100;
    })
    .filter((a): a is number => a != null);
  const avgAccuracy = accuracies.length > 0
    ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
    : null;

  const reviewCount = questions.filter((q) => q.markedForReview).length;

  return {
    summary: {
      topic,
      totalQuestions,
      attemptedQuestions: questions.length,
      avgAccuracy,
      reviewCount,
    },
    questions,
  };
}

// ─── Weekly Progress ─────────────────────────────────────────────────────────

export interface WeeklyProgress {
  week:        string;
  avgAccuracy: number;
}

export function getWeeklyProgress(weeks = 8): WeeklyProgress[] {
  return db.all<WeeklyProgress>(sql`
    SELECT
      strftime('%Y-W%W', a.attempted_at) AS week,
      -- Exclude ≤5-mark questions from accuracy (see getDashboardStats).
      AVG(
        CASE WHEN a.max_mark > 0 AND q.max_mark > 5
             THEN CAST(a.score AS REAL) / a.max_mark * 100
             ELSE NULL END
      ) AS avgAccuracy
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE a.attempted_at >= datetime('now', ${`-${weeks * 7} days`})
      AND a.score IS NOT NULL
    GROUP BY week
    ORDER BY week ASC
  `);
}

// ─── Study Streak ────────────────────────────────────────────────────────────

export function getStudyStreak(): number {
  const rows = db.all<{ date: string }>(sql`
    SELECT DISTINCT DATE(attempted_at) AS date
    FROM attempts
    ORDER BY date DESC
  `);
  if (rows.length === 0) return 0;

  // Use local date string to match SQLite's DATE() which uses server local time
  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine starting point: today or yesterday
  let start = today;
  if (rows[0].date !== localDateStr(today)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (rows[0].date === localDateStr(yesterday)) {
      start = yesterday;
    } else {
      return 0; // last attempt was 2+ days ago
    }
  }

  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(start);
    expected.setDate(expected.getDate() - i);
    if (rows[i].date === localDateStr(expected)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Question Counts ──────────────────────────────────────────────────────────

export interface QuestionCounts {
  total:      number;
  attempted:  number;
  unattempted: number;
}

export function getQuestionCounts(): QuestionCounts {
  const row = db.get<{ total: number; attempted: number }>(sql`
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(CASE WHEN EXISTS(
        SELECT 1 FROM attempts a WHERE a.question_id = q.id
      ) THEN 1 END)                                                     AS attempted
    FROM questions q
  `);
  const total     = row?.total     ?? 0;
  const attempted = row?.attempted ?? 0;
  return { total, attempted, unattempted: total - attempted };
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

export interface ReviewItem {
  attemptId:   number;
  questionId:  number;
  questionNum: number;
  paperId:     number;
  year:        number;
  paperNumber: string;
  topic:       string | null;
  score:       number | null;
  maxMark:     number | null;
  confidence:  number | null;
  mistakeType: string | null;
  notes:       string | null;
  status:      string;
  attemptedAt: string;
}

export function getReviewQueue(filters?: {
  topic?:       string;
  year?:        number;
  paperNumber?: string;
  mistakeType?: string;
}): ReviewItem[] {
  // Build parameterized filter conditions
  const conditions = [
    sql`a.marked_for_review = 1`,
    sql`a.id IN (SELECT id FROM attempts a2 WHERE a2.question_id = a.question_id ORDER BY a2.attempted_at DESC, a2.id DESC LIMIT 1)`,
  ];
  if (filters?.topic)       conditions.push(sql`LOWER(q.topic) = LOWER(${filters.topic})`);
  if (filters?.year)        conditions.push(sql`p.year = ${filters.year}`);
  if (filters?.paperNumber) conditions.push(sql`p.paper_number = ${filters.paperNumber}`);
  if (filters?.mistakeType) conditions.push(sql`a.mistake_type = ${filters.mistakeType}`);

  // Join conditions with AND
  const where = conditions.reduce((acc, cond, i) =>
    i === 0 ? cond : sql`${acc} AND ${cond}`
  );

  return db.all<ReviewItem>(sql`
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
      a.status     AS status,
      a.attempted_at AS attemptedAt
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    JOIN papers p    ON p.id = q.paper_id
    WHERE ${where}
    ORDER BY a.attempted_at ASC
  `);
}
