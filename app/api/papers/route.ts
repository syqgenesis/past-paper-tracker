import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  // Fetch all papers with per-paper stats derived from latest attempts
  const rows = db.all<{
    id:          number;
    year:        number;
    paperNumber: string;
    qpPath:      string | null;
    msPath:      string | null;
    totalQuestions:   number;
    attempted:        number;
    completed:        number;
    avgAccuracy:      number | null;
    avgConfidence:    number | null;
    healthScore:      number | null;
  }>(sql`
    SELECT
      p.id           AS id,
      p.year         AS year,
      p.paper_number AS paperNumber,
      p.qp_path      AS qpPath,
      p.ms_path      AS msPath,
      COUNT(q.id)    AS totalQuestions,
      COUNT(la.id)   AS attempted,
      COUNT(CASE WHEN la.status = 'completed' THEN 1 END) AS completed,
      AVG(
        CASE WHEN la.max_mark > 0
          THEN CAST(la.score AS REAL) / NULLIF(la.max_mark, 0) * 100
          ELSE NULL END
      )              AS avgAccuracy,
      AVG(la.confidence) AS avgConfidence,
      -- Health score: accuracy × confidence, both normalised to 0–1
      AVG(
        CASE WHEN la.max_mark > 0 AND la.confidence IS NOT NULL
          THEN (CAST(la.score AS REAL) / NULLIF(la.max_mark, 0)) * (la.confidence / 5.0)
          ELSE NULL END
      ) * 100        AS healthScore
    FROM papers p
    LEFT JOIN questions q ON q.paper_id = p.id
    LEFT JOIN (
      SELECT a.*
      FROM attempts a
      WHERE a.id = (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC
        LIMIT 1
      )
    ) la ON la.question_id = q.id
    GROUP BY p.id
    ORDER BY p.year DESC, p.paper_number ASC
  `);

  return NextResponse.json(rows);
}
