import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const root = process.env.PAPERS_ROOT;
  if (!root) {
    return NextResponse.json({ error: "PAPERS_ROOT not configured" }, { status: 500 });
  }

  // Resolve to absolute path and jail to PAPERS_ROOT. The `+ path.sep` boundary
  // prevents a sibling dir that shares the root's prefix from escaping the jail
  // (e.g. root "/x/Papers" must not match "/x/Papers-private/...").
  const resolved = path.resolve(filePath);
  const resolvedRoot = path.resolve(root);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
