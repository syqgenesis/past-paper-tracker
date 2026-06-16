// Server-only thin bridge from live DB to the pure session-tracker functions.
// Kept separate from `session-tracker.ts` so the pure functions stay testable
// without needing the DB / `server-only` import chain.

import "server-only";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  computeSessions,
  computeSessionStats,
  type AttemptPoint,
  type SessionStats,
} from "@/lib/session-tracker";

/**
 * Pull attempts from the last 30 days (cheap upper bound on relevant
 * session activity) and roll them up into stats the dashboard + planner
 * both consume.
 */
export function getSessionStats(now: Date = new Date()): SessionStats {
  // 30-day window is generous; sessions older than that don't affect today/week stats
  const rows = db.all<AttemptPoint>(sql`
    SELECT
      a.attempted_at AS attemptedAt,
      q.topic        AS topic,
      a.time_spent   AS timeSpent
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE a.attempted_at >= datetime('now', '-30 days')
    ORDER BY a.attempted_at ASC
  `);
  const sessions = computeSessions(rows);
  return computeSessionStats(sessions, now);
}
