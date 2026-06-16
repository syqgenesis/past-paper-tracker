import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions, attempts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const id = parseInt(questionId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });

  const body = await req.json() as {
    topic?:    string | null;
    subtopic?: string | null;
    maxMark?:  number | null;
  };

  await db.update(questions)
    .set({
      ...(body.topic    !== undefined && { topic:    body.topic }),
      ...(body.subtopic !== undefined && { subtopic: body.subtopic }),
      ...(body.maxMark  !== undefined && { maxMark:  body.maxMark }),
    })
    .where(eq(questions.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const id = parseInt(questionId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });

  // Delete all attempts for this question first (FK constraint)
  await db.delete(attempts).where(eq(attempts.questionId, id));
  await db.delete(questions).where(eq(questions.id, id));
  return NextResponse.json({ ok: true });
}
