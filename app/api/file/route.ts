// Serve resource files (DOCX/PDF/HTML/MD/TSV) from under PAPERS_ROOT. Parallel
// to /api/pdf but with a broader extension whitelist and per-extension
// Content-Type. Same path-traversal guard (jail to resolved PAPERS_ROOT).
//
// Important: never accept an extension not in MIME_TYPES — the keys ARE the
// whitelist. An unknown extension returns 400 rather than falling back to
// octet-stream, so we can't be tricked into serving .env / .sqlite / etc.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".md":   "text/plain; charset=utf-8",        // raw markdown as plain text
  ".tsv":  "text/tab-separated-values; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Browser-renderable types render inline; everything else triggers a download.
const INLINE_TYPES = new Set([".pdf", ".html", ".md", ".tsv"]);

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const root = process.env.PAPERS_ROOT;
  if (!root) {
    return NextResponse.json({ error: "PAPERS_ROOT not configured" }, { status: 500 });
  }

  const resolved = path.resolve(filePath);
  const resolvedRoot = path.resolve(root);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!(ext in MIME_TYPES)) {
    return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  const disposition = INLINE_TYPES.has(ext) ? "inline" : "attachment";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        MIME_TYPES[ext],
      "Content-Disposition": `${disposition}; filename="${path.basename(resolved)}"`,
    },
  });
}
