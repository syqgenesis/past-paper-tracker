// Resource scanner — discovers topic-tagged study materials under PAPERS_ROOT
// (which is the project's /Chem folder; the env var name is historical).
//
// Two locations are scanned, both shallow:
//   1. The root itself — Claude-generated materials with module-code prefixes
//      (A1_Active_Recall_Exercises.docx, B4_Flashcards.docx, …).
//   2. /Handouts — official course PDFs ("A1 2025 heavier TM - student PV.pdf",
//      "PT II A2 HO lectures 1-8 PV.pdf", …).
//
// A file is included iff:
//   - its extension is in EXTENSIONS, AND
//   - a module code (A0–C9 word-boundary match) appears somewhere in the name.
// Files without a module code are dropped — the user opted out of a "General"
// bucket. Build artifacts (.aux/.log/.out) and lockfiles (~$*) are filtered.

import "server-only";

import fs from "fs";
import path from "path";

export interface Resource {
  topic:     string;     // module code, e.g. "A1", "C5"
  filename:  string;     // basename for display
  fullPath:  string;     // absolute path on disk (used by /api/file)
  relPath:   string;     // path relative to ROOT, for the API query
  source:    "root" | "handouts";
  extension: string;     // lowercase, with leading dot, e.g. ".pdf"
  sizeBytes: number;
  modifiedAt: string;    // ISO datetime
}

export interface ResourcesByTopic {
  topic:     string;
  resources: Resource[];
}

// Whitelisted file extensions. Everything else is hidden from the UI even if
// it happens to live next to the resources.
export const EXTENSIONS = new Set([".pdf", ".docx", ".html", ".md", ".tsv"]);

// Module codes look like "A1", "B4", "C5". Bounded by non-alphanumerics on
// both sides — NOT plain \b, because \b treats "_" as a word character and
// "A1_foo" would never match. Lookarounds ban only A–Z/a–z/0–9 on the edges,
// so underscores, hyphens, spaces, dots, and string boundaries all qualify.
// Examples:
//   "A1_Active_Recall.docx"     → A1   (start, underscore)
//   "PT II A1 Ln An 2025.pdf"   → A1   (space, space)
//   "Direct_Methods_Notes_C6.docx" → C6 (underscore, dot)
//   "ABC123.pdf"                → null (B preceded by 'A')
const MODULE_CODE_RX = /(?<![A-Za-z0-9])([A-C][0-9])(?![A-Za-z0-9])/;

/**
 * Extract the first module code from a filename, or null if none.
 * Case-insensitive: matches "a1" as well as "A1", normalised to uppercase.
 */
export function extractTopic(filename: string): string | null {
  const m = filename.toUpperCase().match(MODULE_CODE_RX);
  return m ? m[1] : null;
}

/**
 * Return true if the file should be surfaced in the Resources UI. Filters:
 *  - extension must be in EXTENSIONS
 *  - filename must not be a Word/Excel lock-file ("~$Foo.docx")
 *  - hidden dotfiles are excluded
 *  - filename must contain a module code
 */
export function shouldInclude(filename: string): boolean {
  if (filename.startsWith(".")) return false;
  if (filename.startsWith("~$")) return false;
  const ext = path.extname(filename).toLowerCase();
  if (!EXTENSIONS.has(ext)) return false;
  return extractTopic(filename) != null;
}

function getRoot(): string {
  const root = process.env.PAPERS_ROOT;
  if (!root) throw new Error("PAPERS_ROOT env var is required for resource scanning");
  return path.resolve(root);
}

function scanDir(absDir: string, source: Resource["source"], root: string): Resource[] {
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const resources: Resource[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!shouldInclude(entry.name)) continue;
    const fullPath = path.join(absDir, entry.name);
    const stat = fs.statSync(fullPath);
    resources.push({
      topic:      extractTopic(entry.name)!,  // shouldInclude guarantees this
      filename:   entry.name,
      fullPath,
      relPath:    path.relative(root, fullPath),
      source,
      extension:  path.extname(entry.name).toLowerCase(),
      sizeBytes:  stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  return resources;
}

/**
 * Scan disk and group by topic. Topics are returned in alphabetical order;
 * resources within a topic are sorted by modifiedAt DESC (newest first) since
 * the user is more likely to want recent generations.
 */
export function scanResources(): ResourcesByTopic[] {
  const root = getRoot();
  const all = [
    ...scanDir(root, "root", root),
    ...scanDir(path.join(root, "Handouts"), "handouts", root),
  ];

  // Group by topic
  const byTopic = new Map<string, Resource[]>();
  for (const r of all) {
    if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
    byTopic.get(r.topic)!.push(r);
  }

  // Sort topics alphabetically, files within a topic by mtime DESC
  return [...byTopic.keys()]
    .sort()
    .map((topic) => ({
      topic,
      resources: byTopic.get(topic)!.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
    }));
}
