// server-only: never import this in client components — better-sqlite3 is a Node native module
import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import path from "path";
import fs from "fs";

function getDbPath(): string {
  const raw = process.env.DATABASE_PATH ?? "./data/tracker.db";
  // Resolve relative to project root (cwd when running next dev/build)
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function createDb() {
  const dbPath = getDbPath();
  // Ensure the data directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);

  // DELETE journal mode: no separate WAL/SHM files — safer on iCloud-synced dirs
  sqlite.pragma("journal_mode = DELETE");
  sqlite.pragma("foreign_keys = ON");

  // Run schema migrations inline (idempotent CREATE TABLE IF NOT EXISTS)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      year         INTEGER NOT NULL,
      paper_number TEXT NOT NULL,
      qp_path      TEXT,
      ms_path      TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(year, paper_number)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id     INTEGER NOT NULL REFERENCES papers(id),
      question_num INTEGER NOT NULL,
      topic        TEXT,
      subtopic     TEXT,
      max_mark     INTEGER,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(paper_id, question_num)
    );

    CREATE TABLE IF NOT EXISTS attempts (
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

    CREATE INDEX IF NOT EXISTS idx_attempts_question_date
      ON attempts(question_id, attempted_at DESC);
  `);

  // Drop the legacy `plans` table from installs that ran a pre-removal build.
  // Idempotent; cheap; runs once per boot.
  sqlite.exec(`
    DROP INDEX IF EXISTS idx_plans_generated_at;
    DROP INDEX IF EXISTS idx_plans_source_generated;
    DROP TABLE IF EXISTS plans;
  `);

  return drizzle(sqlite, { schema });
}

// Singleton — reuse across hot-reloads in development
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };
export const db = globalForDb.db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
