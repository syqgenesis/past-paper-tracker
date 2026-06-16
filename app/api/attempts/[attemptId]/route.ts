import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attempts, questions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { MistakeType, QuestionStatus } from "@/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const id = parseInt(attemptId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 });

  const body = await req.json() as {
    status?:         QuestionStatus;
    score?:          number | null;
    maxMark?:        number | null;
    confidence?:     number | null;
    mistakeType?:    MistakeType | null;
    notes?:          string | null;
    markedForReview?: boolean;
  };

  await db.update(attempts)
    .set({
      ...(body.status         !== undefined && { status:          body.status }),
      ...(body.score          !== undefined && { score:           body.score }),
      ...(body.maxMark        !== undefined && { maxMark:         body.maxMark }),
      ...(body.confidence     !== undefined && { confidence:      body.confidence }),
      ...(body.mistakeType    !== undefined && { mistakeType:      body.mistakeType }),
      ...(body.notes          !== undefined && { notes:           body.notes }),
      ...(body.markedForReview !== undefined && { markedForReview: body.markedForReview ? 1 : 0 }),
    })
    .where(eq(attempts.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const id = parseInt(attemptId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 });

  // Find the question this attempt belongs to before deleting
  const attempt = db.get<{ questionId: number }>(sql`
    SELECT question_id AS questionId FROM attempts WHERE id = ${id}
  `);

  await db.delete(attempts).where(eq(attempts.id, id));

  // If no attempts remain for this question, delete the question too
  if (attempt) {
    const remaining = db.get<{ cnt: number }>(sql`
      SELECT COUNT(*) AS cnt FROM attempts WHERE question_id = ${attempt.questionId}
    `);
    if (!remaining || remaining.cnt === 0) {
      await db.delete(questions).where(eq(questions.id, attempt.questionId));
      return NextResponse.json({ ok: true, questionDeleted: true });
    }
  }

  return NextResponse.json({ ok: true, questionDeleted: false });
}
