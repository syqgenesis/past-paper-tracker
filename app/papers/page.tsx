export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

type PaperRow = {
  id: number;
  year: number;
  paperNumber: string;
  qpPath: string | null;
  msPath: string | null;
  totalQuestions: number;
  attempted: number;
  healthScore: number | null;
};

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400 font-medium">
        —
      </span>
    );
  }
  const color =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {Math.round(score)}
    </span>
  );
}

export default function PapersPage() {
  const rows = db.all<PaperRow>(sql`
    SELECT
      p.id           AS id,
      p.year         AS year,
      p.paper_number AS paperNumber,
      p.qp_path      AS qpPath,
      p.ms_path      AS msPath,
      COUNT(q.id)    AS totalQuestions,
      COUNT(la.id)   AS attempted,
      AVG(
        CASE WHEN la.max_mark > 0 AND la.confidence IS NOT NULL
          THEN (CAST(la.score AS REAL) / NULLIF(la.max_mark, 0)) * (la.confidence / 5.0)
          ELSE NULL END
      ) * 100        AS healthScore
    FROM papers p
    LEFT JOIN questions q ON q.paper_id = p.id
    LEFT JOIN (
      SELECT a.*
      FROM attempts a
      WHERE a.id = (
        SELECT id FROM attempts a2
        WHERE a2.question_id = a.question_id
        ORDER BY a2.attempted_at DESC, a2.id DESC
        LIMIT 1
      )
    ) la ON la.question_id = q.id
    GROUP BY p.id
    ORDER BY p.year DESC, p.paper_number ASC
  `);

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Papers</h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-zinc-500 mb-4">No papers found.</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Run a scan in Settings →
          </Link>
        </div>
      </div>
    );
  }

  // Group by year
  const byYear = new Map<number, PaperRow[]>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year)!.push(row);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  // Total stats
  const totalQuestions = rows.reduce((s, r) => s + r.totalQuestions, 0);
  const totalAttempted = rows.reduce((s, r) => s + r.attempted, 0);
  const totalCompletion = totalQuestions > 0 ? Math.round((totalAttempted / totalQuestions) * 100) : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Papers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {totalAttempted}/{totalQuestions} questions attempted ({totalCompletion}%)
          </p>
        </div>
        <div className="w-32">
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${totalCompletion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {years.map((year) => {
          const papers = byYear.get(year)!;
          const yearTotal = papers.reduce((s, p) => s + p.totalQuestions, 0);
          const yearAttempted = papers.reduce((s, p) => s + p.attempted, 0);
          const yearPct = yearTotal > 0 ? Math.round((yearAttempted / yearTotal) * 100) : 0;

          return (
            <div key={year}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  {year}
                </h2>
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-1 flex-1 max-w-24 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        yearPct === 100 ? "bg-green-500" : "bg-indigo-400"
                      }`}
                      style={{ width: `${yearPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400">{yearPct}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {papers.map((paper) => {
                  const completion =
                    paper.totalQuestions > 0
                      ? Math.round((paper.attempted / paper.totalQuestions) * 100)
                      : null;
                  return (
                    <Link
                      key={paper.id}
                      href={`/papers/${paper.year}/${paper.paperNumber}`}
                      className="group rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-semibold text-zinc-900 text-sm">
                          Paper {paper.paperNumber}
                        </span>
                        <HealthBadge score={paper.healthScore} />
                      </div>
                      {paper.totalQuestions === 0 ? (
                        <p className="text-xs text-zinc-400">No questions yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>
                              {paper.attempted}/{paper.totalQuestions}
                            </span>
                            <span>{completion}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                completion === 100 ? "bg-green-500" : "bg-indigo-500"
                              }`}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
