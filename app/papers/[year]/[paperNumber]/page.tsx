import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PaperDetailClient, type QuestionWithAttempt } from "./paper-detail-client";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ year: string; paperNumber: string }>;
}) {
  const { year: yearStr, paperNumber } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) notFound();

  const paper = db.get<{ id: number; year: number; paperNumber: string; qpPath: string | null; msPath: string | null }>(sql`
    SELECT id, year, paper_number AS paperNumber, qp_path AS qpPath, ms_path AS msPath
    FROM papers
    WHERE year = ${year} AND paper_number = ${paperNumber}
    LIMIT 1
  `);

  if (!paper) notFound();

  const questions = db.all<QuestionWithAttempt>(sql`
    SELECT
      q.id           AS id,
      q.question_num AS questionNum,
      q.topic        AS topic,
      q.subtopic     AS subtopic,
      q.max_mark     AS maxMark,
      la.status      AS status,
      la.score       AS score,
      la.confidence  AS confidence,
      la.mistake_type     AS mistakeType,
      la.marked_for_review AS markedForReview,
      la.attempted_at      AS attemptedAt
    FROM questions q
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
    WHERE q.paper_id = ${paper.id}
    ORDER BY q.question_num ASC
  `);

  const attempted = questions.filter((q) => q.status !== null && q.status !== "not_started").length;
  const completion = questions.length > 0 ? Math.round((attempted / questions.length) * 100) : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
          <Link href="/papers" className="hover:text-indigo-600 transition-colors">
            Papers
          </Link>
          <span>›</span>
          <span>{year}</span>
          <span>›</span>
          <span className="text-zinc-700 font-medium">Paper {paper.paperNumber}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900 whitespace-nowrap">
            {year} — Paper {paper.paperNumber}
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            {paper.qpPath && (
              <a
                href={`/api/pdf?path=${encodeURIComponent(paper.qpPath)}`}
                target="_blank"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
              >
                Question Paper ↗
              </a>
            )}
            {paper.msPath && (
              <a
                href={`/api/pdf?path=${encodeURIComponent(paper.msPath)}`}
                target="_blank"
                className="text-xs font-medium text-zinc-600 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition-colors"
              >
                Mark Scheme ↗
              </a>
            )}
          </div>
        </div>
        {questions.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>{attempted}/{questions.length} questions attempted</span>
                <span>{completion}%</span>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Question table + add form */}
      <PaperDetailClient paperId={paper.id} questions={questions} />
    </div>
  );
}
