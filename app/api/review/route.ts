import { NextResponse } from "next/server";
import { getReviewQueue } from "@/lib/analytics";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const filters = {
    topic:       searchParams.get("topic")       ?? undefined,
    year:        searchParams.get("year")        ? parseInt(searchParams.get("year")!, 10) : undefined,
    paperNumber: searchParams.get("paperNumber") ?? undefined,
    mistakeType: searchParams.get("mistakeType") ?? undefined,
  };

  const items = getReviewQueue(filters);
  return NextResponse.json(items);
}
