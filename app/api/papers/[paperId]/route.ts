import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;
  const id = parseInt(paperId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid paper ID" }, { status: 400 });

  const paper = db.get<{ id: number; year: number; paperNumber: string; qpPath: string | null; msPath: string | null }>(sql`
    SELECT id, year, paper_number AS paperNumber, qp_path AS qpPath, ms_path AS msPath
    FROM papers WHERE id = ${id}
  `);
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  const questions = db.all<{
    id:          number;
    questionNum: number;
    topic:       string | null;
    subtopic:    string | null;
    maxMark:     number | null;
    // Latest attempt fields
    status:      string | null;
    score:       number | null;
    confidence:  number | null;
    mistakeType: string | null;
    markedForReview: number | null;
    attemptedAt: string | null;
  }>(sql`
    SELECT
      q.id           AS id,
      q.question_num AS questionNum,
      q.topic        AS topic,
      q.subtopic     AS subtopic,
      q.max_mark     AS maxMark,
      la.status      AS status,
      la.score       AS score,
      la.confidence  AS confidence,
      la.mistake_type AS mistakeType,
      la.marked_for_review AS markedForReview,
      la.attempted_at AS attemptedAt
    FROM questions q
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
    WHERE q.paper_id = ${id}
    ORDER BY q.question_num ASC
  `);

  return NextResponse.json({ paper, questions });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;
  const id = parseInt(paperId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid paper ID" }, { status: 400 });

  const body = await req.json() as { qpPath?: string; msPath?: string };

  db.run(sql`
    UPDATE papers
    SET
      qp_path = COALESCE(${body.qpPath ?? null}, qp_path),
      ms_path = COALESCE(${body.msPath ?? null}, ms_path)
    WHERE id = ${id}
  `);

  return NextResponse.json({ ok: true });
}
