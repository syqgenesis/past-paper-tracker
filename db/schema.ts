import { sqliteTable, integer, text, real, index, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── papers ──────────────────────────────────────────────────────────────────
// One row per logical paper (e.g. 2023 Paper 2A).
// Integer PK so correcting a mislabelled paper_number never orphans questions/attempts.
// (year, paper_number) is the uniqueness constraint — not the PK.
export const papers = sqliteTable(
  "papers",
  {
    id:          integer("id").primaryKey({ autoIncrement: true }),
    year:        integer("year").notNull(),
    paperNumber: text("paper_number").notNull(),   // "1" | "2A" | "2B" | "3" | "4" | "UNKNOWN-N"
    qpPath:      text("qp_path"),                   // absolute path to question paper PDF
    msPath:      text("ms_path"),                   // absolute path to mark scheme PDF
    createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [unique().on(t.year, t.paperNumber)]
);

// ─── questions ───────────────────────────────────────────────────────────────
// One row per question in a paper. Topics are free-text for now (normalised later).
export const questions = sqliteTable(
  "questions",
  {
    id:          integer("id").primaryKey({ autoIncrement: true }),
    paperId:     integer("paper_id").notNull().references(() => papers.id),
    questionNum: integer("question_num").notNull(),
    topic:       text("topic"),
    subtopic:    text("subtopic"),
    maxMark:     integer("max_mark"),
    createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [unique().on(t.paperId, t.questionNum)]
);

// ─── attempts ────────────────────────────────────────────────────────────────
// Append-only log. "Current state" = latest row per question_id.
// Indexed on (question_id, attempted_at DESC) for efficient latest-attempt subqueries.
export const attempts = sqliteTable(
  "attempts",
  {
    id:              integer("id").primaryKey({ autoIncrement: true }),
    questionId:      integer("question_id").notNull().references(() => questions.id),
    // not_started | attempted | completed | review_needed
    status:          text("status").notNull().default("attempted"),
    score:           real("score"),
    maxMark:         real("max_mark"),        // snapshot at time of attempt
    confidence:      integer("confidence"),   // 1–5
    // conceptual | calculation | misread | forgot_formula | time_pressure | careless | none
    mistakeType:     text("mistake_type"),
    notes:           text("notes"),
    markedForReview: integer("marked_for_review").default(0), // 0 | 1
    timeSpent:       integer("time_spent"),   // seconds
    attemptedAt:     text("attempted_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_attempts_question_date").on(t.questionId, t.attemptedAt),
  ]
);

// ─── Types ───────────────────────────────────────────────────────────────────
export type Paper    = typeof papers.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Attempt  = typeof attempts.$inferSelect;

export type NewPaper    = typeof papers.$inferInsert;
export type NewQuestion = typeof questions.$inferInsert;
export type NewAttempt  = typeof attempts.$inferInsert;

export type QuestionStatus = "not_started" | "attempted" | "completed" | "review_needed";
export type MistakeType    = "conceptual" | "calculation" | "misread" | "forgot_formula" | "time_pressure" | "careless" | "none";
export type PaperNumber    = "1" | "2A" | "2B" | "3" | "4";
