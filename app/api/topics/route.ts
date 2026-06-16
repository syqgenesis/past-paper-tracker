import { NextResponse } from "next/server";
import { getDistinctTopics } from "@/lib/analytics";

export async function GET() {
  return NextResponse.json(getDistinctTopics());
}
