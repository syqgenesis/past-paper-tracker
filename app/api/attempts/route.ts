import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attempts } from "@/db/schema";
import type { MistakeType, QuestionStatus } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json() as {
    questionId:      number;
    status?:         QuestionStatus;
    score?:          number | null;
    maxMark?:        number | null;
    confidence?:     number | null;
    mistakeType?:    MistakeType | null;
    notes?:          string | null;
    markedForReview?: boolean;
    timeSpent?:      number | null;
  };

  if (!body.questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const [inserted] = await db.insert(attempts).values({
    questionId:      body.questionId,
    status:          body.status          ?? "attempted",
    score:           body.score           ?? null,
    maxMark:         body.maxMark         ?? null,
    confidence:      body.confidence      ?? null,
    mistakeType:     body.mistakeType     ?? null,
    notes:           body.notes           ?? null,
    markedForReview: body.markedForReview ? 1 : 0,
    timeSpent:       body.timeSpent       ?? null,
  }).returning();

  return NextResponse.json(inserted, { status: 201 });
}
