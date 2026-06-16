// server-only: reads the local filesystem
import "server-only";

import fs from "fs";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScanReport {
  scanned:        number;
  matched:        number;
  unmatched:      number;
  unmatchedFiles: string[];
  error?:         string;
  papers:         ScannedPaper[];
}

export interface ScannedPaper {
  year:        number;
  paperNumber: string;   // "1" | "2A" | "2B" | "3" | "4" | "UNKNOWN-N"
  qpPath:      string;
  msPath:      string | null;
}

// ─── Pattern Definitions ─────────────────────────────────────────────────────
//
// Ordered array — first match wins. Each entry maps a filename regex to a
// paper number extractor. Covers all observed naming conventions from 2016–2025.
//
// Known conventions:
//   II_2016_Paper1A.pdf           → 1A  (treated as "1" — Part A means first half of paper 1)
//   II_2016_Paper2A.pdf           → 2A
//   II_2016_Paper3.pdf            → 3
//   Part_II_2020 Paper 1 answers  → skip (answers folder)
//   Paper 1 final.pdf             → 1   (2023 style)
//   Part ll Paper 2A.pdf          → 2A  (2024 style, uses lowercase L)
//   Part ll 2024 - Paper 1 QP.pdf → 1   (2024 QP style)

interface PaperPattern {
  regex:   RegExp;
  extract: (match: RegExpMatchArray) => string;
}

const PAPER_PATTERNS: PaperPattern[] = [
  // "II_YEAR_Paper2A.pdf" or "II_YEAR_Paper1A.pdf"
  {
    regex:   /II_\d{4}_Paper(\d+)([AB])?/i,
    extract: (m) => m[1] + (m[2] ?? ""),
  },
  // "Part ll 2024 - Paper 1 QP.pdf" or "Part II 2024 - Paper 2A QP.pdf"
  {
    regex:   /Part\s+[lLiI]{2}\s+\d{4}\s*[-–]\s*Paper\s+(\d+)([AB])?/i,
    extract: (m) => m[1] + (m[2]?.toUpperCase() ?? ""),
  },
  // "Part ll Paper 2A.pdf" or "Part II Paper 3.pdf"
  {
    regex:   /Part\s+[lLiI]{2}\s+Paper\s+(\d+)([AB])?/i,
    extract: (m) => m[1] + (m[2]?.toUpperCase() ?? ""),
  },
  // "Paper 1 final.pdf" or "Paper 2A.pdf" or "Paper 3 questions.pdf"
  // Also "II 2015 Paper1A.pdf" (no space between "Paper" and digit) — \s* not \s+
  {
    regex:   /Paper\s*(\d+)([AB])?(?:\s|_|-|\.)/i,
    extract: (m) => m[1] + (m[2]?.toUpperCase() ?? ""),
  },
  // "II_2022_Paper_1.pdf" or "II_2022_Paper_2A.pdf" (underscore before number)
  {
    regex:   /II_\d{4}_Paper_(\d+)([AB])?/i,
    extract: (m) => m[1] + (m[2]?.toUpperCase() ?? ""),
  },
  // "II_2017_1A.pdf" or "II_2018_2A.pdf" — no "Paper" word, just number after year
  {
    regex:   /II_\d{4}_(\d+)([AB])?(?:\.pdf)?$/i,
    extract: (m) => m[1] + (m[2]?.toUpperCase() ?? ""),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function inferPaperNumber(filename: string): string | null {
  for (const { regex, extract } of PAPER_PATTERNS) {
    const match = filename.match(regex);
    if (match) {
      const num = extract(match);
      // Normalise: Papers 1, 3, 4 are sometimes split into A/B halves but
      // are considered the same logical paper for tracking purposes.
      if (num === "1A" || num === "1B") return "1";
      if (num === "3A" || num === "3B") return "3";
      if (num === "4A" || num === "4B") return "4";
      return num;
    }
  }
  return null;
}

function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

function isYearFolder(name: string): boolean {
  return /^\d{4}$/.test(name) || /II\s+\d{4}$/.test(name) || /^\d{4}\s*$/.test(name.trim());
}

function extractYear(folderName: string): number {
  const match = folderName.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

export function scanPapers(): ScanReport {
  const papersRoot = process.env.PAPERS_ROOT;

  if (!papersRoot) {
    return {
      scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], papers: [],
      error: "PAPERS_ROOT environment variable is not set. Add it to .env.local.",
    };
  }

  if (!fs.existsSync(papersRoot)) {
    return {
      scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], papers: [],
      error: `PAPERS_ROOT path does not exist: ${papersRoot}`,
    };
  }

  // Locate the QP and MS root folders
  let qpRoot: string | null = null;
  let msRoot: string | null = null;

  try {
    const entries = fs.readdirSync(papersRoot);
    for (const entry of entries) {
      const lower = entry.toLowerCase();
      if (lower.includes("suggested answers") || lower.includes("mark scheme")) {
        msRoot = path.join(papersRoot, entry);
      } else if (lower.includes("tripos") || lower.includes("past")) {
        // Pick the one that doesn't include "answer" as the QP root
        if (!lower.includes("answer") && !lower.includes("mark")) {
          qpRoot = path.join(papersRoot, entry);
        }
      }
    }
  } catch (err) {
    return {
      scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], papers: [],
      error: `Cannot read PAPERS_ROOT: ${String(err)}`,
    };
  }

  if (!qpRoot) {
    return {
      scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], papers: [],
      error: `Could not locate question paper folder inside ${papersRoot}. Expected a subfolder whose name contains "Tripos" or "past" but not "answer".`,
    };
  }

  const scannedPapers: ScannedPaper[] = [];
  const unmatchedFiles: string[] = [];
  let totalScanned = 0;
  const unknownCounters: Record<number, number> = {};

  // Scan QP root for year folders
  let yearFolders: string[];
  try {
    yearFolders = fs.readdirSync(qpRoot).filter((f) => {
      const full = path.join(qpRoot!, f);
      return fs.statSync(full).isDirectory() && isYearFolder(f);
    });
  } catch (err) {
    return {
      scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], papers: [],
      error: `Cannot read QP folder: ${String(err)}`,
    };
  }

  for (const yearFolder of yearFolders) {
    const year = extractYear(yearFolder);
    if (!year) continue;

    const yearPath = path.join(qpRoot, yearFolder);
    let files: string[];
    try {
      files = fs.readdirSync(yearPath).filter(isPdf);
    } catch {
      continue;
    }

    for (const file of files) {
      totalScanned++;
      const paperNumber = inferPaperNumber(file);

      if (!paperNumber) {
        unknownCounters[year] = (unknownCounters[year] ?? 0) + 1;
        const unknownKey = `UNKNOWN-${unknownCounters[year]}`;
        unmatchedFiles.push(`${year}/${file}`);
        scannedPapers.push({
          year,
          paperNumber: unknownKey,
          qpPath: path.join(yearPath, file),
          msPath: null,
        });
        continue;
      }

      // Attempt to find the corresponding mark scheme
      const msPath = findMarkScheme(msRoot, year, paperNumber, file);

      scannedPapers.push({
        year,
        paperNumber,
        qpPath: path.join(yearPath, file),
        msPath,
      });
    }
  }

  const matched = scannedPapers.filter((p) => !p.paperNumber.startsWith("UNKNOWN")).length;

  return {
    scanned:        totalScanned,
    matched,
    unmatched:      unmatchedFiles.length,
    unmatchedFiles,
    papers:         scannedPapers,
  };
}

// ─── Mark Scheme Finder ───────────────────────────────────────────────────────

/**
 * Extract the exam year referenced by a filename, ignoring date stamps like
 * "15.05.2024" (an update date, not an exam year). Returns the END year of
 * academic-year ranges like "2017-18" (i.e. the calendar year the exam was sat).
 */
export function inferFileYear(file: string): number | null {
  // Strip "DD.MM.YYYY", "DD-MM-YYYY", "DD/MM/YYYY" and ISO date stamps so they
  // aren't mistaken for exam years.
  const cleaned = file
    .replace(/\d{1,2}[.\-/]\d{1,2}[.\-/](?:19|20)\d{2}/g, "")
    .replace(/(?:19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/g, "");

  // Academic year range, e.g. "2017-18" or "2017-2018" → use end year
  const range = cleaned.match(/((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/);
  if (range) {
    const start = parseInt(range[1], 10);
    const endRaw = parseInt(range[2], 10);
    return endRaw < 100 ? Math.floor(start / 100) * 100 + endRaw : endRaw;
  }

  const m = cleaned.match(/(?:19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

function findMarkScheme(
  msRoot:      string | null,
  year:        number,
  paperNumber: string,
  _qpFilename: string
): string | null {
  if (!msRoot || !fs.existsSync(msRoot)) return null;

  // Build candidate folders by *discovery*, not a hardcoded list. A folder is
  // a candidate if its name contains the year OR any PDF inside it references
  // the year. This avoids the previous bug where a hardcoded "New folder"
  // (which actually contains only 2022 PDFs) was tried for every year and
  // poisoned years that had no MS folder of their own.
  let allEntries: string[];
  try {
    allEntries = fs.readdirSync(msRoot);
  } catch {
    return null;
  }

  const candidateFolders: string[] = [];
  for (const entry of allEntries) {
    const full = path.join(msRoot, entry);
    let isDir = false;
    try { isDir = fs.statSync(full).isDirectory(); } catch { continue; }
    if (!isDir) continue;

    // Skip "year 2" duplicate folders (e.g. "2016 2", "ll 2024 2")
    if (/\s\d+$/.test(entry) && !entry.includes(String(year))) continue;

    // Accept folders whose name contains the year (e.g. "2015", "II 2023", "ll 2024")
    if (entry.includes(String(year))) {
      candidateFolders.push(full);
      continue;
    }

    // Otherwise sniff files inside — if any file's inferred exam year matches,
    // include this folder. Catches the "New folder" → 2022 case without
    // hardcoding folder names.
    try {
      const files = fs.readdirSync(full).filter(isPdf);
      if (files.some(f => inferFileYear(f) === year)) {
        candidateFolders.push(full);
      }
    } catch { /* skip unreadable folders */ }
  }

  // Guard: a candidate file must (a) infer the requested paper number AND
  // (b) either reference the requested year in its filename, or have no
  // year in its filename (in which case the parent folder supplies year context).
  function fileMatches(file: string): boolean {
    if (inferPaperNumber(file) !== paperNumber) return false;
    const fy = inferFileYear(file);
    return fy === null || fy === year;
  }

  for (const folder of candidateFolders) {
    let files: string[];
    try {
      files = fs.readdirSync(folder).filter(isPdf);
    } catch {
      continue;
    }

    // First pass: prefer files that look like answers/mark schemes.
    for (const file of files) {
      if (!fileMatches(file)) continue;
      const lower = file.toLowerCase();
      if (
        lower.includes("answer") ||
        lower.includes("combined") ||
        lower.includes("suggested") ||
        lower.includes("mark scheme")
      ) {
        return path.join(folder, file);
      }
    }

    // Second pass: any file with the right paper number and consistent year.
    for (const file of files) {
      if (fileMatches(file)) return path.join(folder, file);
    }
  }

  return null;
}
