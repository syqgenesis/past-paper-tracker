import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const id = parseInt(questionId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });

  const attempts = db.all<{
    id: number;
    score: number | null;
    maxMark: number | null;
    confidence: number | null;
    mistakeType: string | null;
    notes: string | null;
    status: string;
    markedForReview: number;
    attemptedAt: string;
  }>(sql`
    SELECT
      id,
      score,
      max_mark AS maxMark,
      confidence,
      mistake_type AS mistakeType,
      notes,
      status,
      marked_for_review AS markedForReview,
      attempted_at AS attemptedAt
    FROM attempts
    WHERE question_id = ${id}
    ORDER BY attempted_at DESC
  `);

  return NextResponse.json(attempts);
}
