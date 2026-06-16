import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;
  const id = parseInt(paperId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid paper ID" }, { status: 400 });

  const body = await req.json() as {
    questionNum: number;
    topic?:      string;
    subtopic?:   string;
    maxMark?:    number;
  };

  if (!body.questionNum) {
    return NextResponse.json({ error: "questionNum is required" }, { status: 400 });
  }

  try {
    const [inserted] = await db.insert(questions).values({
      paperId:     id,
      questionNum: body.questionNum,
      topic:       body.topic    ?? null,
      subtopic:    body.subtopic ?? null,
      maxMark:     body.maxMark  ?? null,
    }).returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: unknown) {
    if (String(err).includes("UNIQUE constraint")) {
      return NextResponse.json({ error: `Question ${body.questionNum} already exists in this paper` }, { status: 409 });
    }
    throw err;
  }
}
