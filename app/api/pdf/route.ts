import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Resolve to absolute path and guard against path traversal
  const resolved = path.resolve(filePath);
  const papersRoot = process.env.PAPERS_ROOT;
  if (papersRoot) {
    const resolvedRoot = path.resolve(papersRoot);
    if (!resolved.startsWith(resolvedRoot)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  if (!resolved.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are served" }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
    },
  });
}
