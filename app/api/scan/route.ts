import { NextResponse } from "next/server";
import { scanPapers } from "@/lib/scanner";
import { db } from "@/lib/db";
import { papers } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST() {
  const report = scanPapers();

  if (report.error) {
    return NextResponse.json({ error: report.error }, { status: 400 });
  }

  // Remove stale UNKNOWN-* rows whose year is now fully matched.
  // This handles the case where a previous scan created UNKNOWN rows and a pattern fix
  // now correctly identifies those papers — the UNKNOWN rows would otherwise linger.
  const matchedYears = [...new Set(
    report.papers
      .filter((p) => !p.paperNumber.startsWith("UNKNOWN"))
      .map((p) => p.year)
  )];
  for (const year of matchedYears) {
    db.run(sql`
      DELETE FROM papers
      WHERE year = ${year}
        AND paper_number LIKE 'UNKNOWN%'
        AND id NOT IN (SELECT paper_id FROM questions)
    `);
  }

  // Upsert all scanned papers — idempotent, never overwrites ms_path if manually set
  let upserted = 0;
  for (const paper of report.papers) {
    db.run(sql`
      INSERT INTO papers (year, paper_number, qp_path, ms_path)
      VALUES (${paper.year}, ${paper.paperNumber}, ${paper.qpPath}, ${paper.msPath})
      ON CONFLICT(year, paper_number)
      DO UPDATE SET
        qp_path = CASE WHEN excluded.qp_path IS NOT NULL THEN excluded.qp_path ELSE qp_path END,
        ms_path = CASE WHEN excluded.ms_path IS NOT NULL THEN excluded.ms_path ELSE ms_path END
    `);
    upserted++;
  }

  return NextResponse.json({
    scanned:        report.scanned,
    matched:        report.matched,
    unmatched:      report.unmatched,
    unmatchedFiles: report.unmatchedFiles,
    upserted,
  });
}
