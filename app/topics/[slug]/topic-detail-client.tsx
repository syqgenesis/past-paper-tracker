"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TopicDetailRow } from "@/lib/analytics";

type SortKey = "paper" | "score" | "confidence" | "review" | "attemptedAt";
type SortDir = "asc" | "desc";

// ─── Filter types ────────────────────────────────────────────────────────────
// Score buckets align with the AccuracyBadge thresholds used elsewhere (<50, 50–75, ≥75)
// so the visual taxonomy stays consistent across pages.
export type ScoreBucket = "all" | "lt50" | "mid" | "gte75" | "unscored";
export type DateBucket  = "all" | "7d" | "30d" | "90d";

const MISTAKE_LABELS: Record<string, string> = {
  conceptual:     "Conceptual",
  calculation:    "Calculation",
  misread:        "Misread",
  forgot_formula: "Forgot formula",
  time_pressure:  "Time pressure",
  careless:       "Careless",
  none:           "None",
};

interface Props {
  questions: TopicDetailRow[];
}

export function TopicDetailClient({ questions }: Props) {
  // Default: weakest first — accuracy ASC, then review-flagged float to top.
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Filter state. Defaults are all permissive so the initial render is unfiltered
  // and matches SSR output exactly (no hydration mismatch).
  const [filterYear,  setFilterYear]  = useState<number | "all">("all");
  const [filterScore, setFilterScore] = useState<ScoreBucket>("all");
  const [filterDate,  setFilterDate]  = useState<DateBucket>("all");

  function toggleExpand(attemptId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Paper and attemptedAt default to DESC (newest first); accuracy/conf/review default ASC (weakest first).
      setSortDir(key === "paper" || key === "attemptedAt" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setFilterYear("all");
    setFilterScore("all");
    setFilterDate("all");
  }

  const distinctYears = useMemo(() => {
    return [...new Set(questions.map((q) => q.year))].sort((a, b) => b - a);
  }, [questions]);

  // Filter first, then sort. Each is its own memo so the sort doesn't redo
  // filtering when only the sort key changes.
  const filtered = useMemo(() => {
    return questions.filter((q) =>
      matchesYear(q, filterYear) &&
      matchesScoreBucket(q, filterScore) &&
      matchesDateBucket(q, filterDate)
    );
  }, [questions, filterYear, filterScore, filterDate]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const filtersActive = filterYear !== "all" || filterScore !== "all" || filterDate !== "all";

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        No attempts logged on this topic yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FilterBar
        years={distinctYears}
        year={filterYear} setYear={setFilterYear}
        score={filterScore} setScore={setFilterScore}
        date={filterDate} setDate={setFilterDate}
        filtersActive={filtersActive}
        onClear={clearFilters}
        shownCount={filtered.length}
        totalCount={questions.length}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          No attempts match these filters.{" "}
          <button type="button" onClick={clearFilters} className="underline hover:text-zinc-900">
            Clear filters
          </button>{" "}
          to see all {questions.length}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <SortHeader label="Paper"      sortKey="paper"       current={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
                <th className="px-3 py-3 text-center font-medium">Q#</th>
                <SortHeader label="Score"      sortKey="score"       current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Conf."      sortKey="confidence"  current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-3 text-left font-medium">Mistake</th>
                <th className="px-3 py-3 text-left font-medium">Your notes</th>
                <SortHeader label="Review"     sortKey="review"      current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Attempted"  sortKey="attemptedAt" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {sorted.map((q) => {
                const isExpanded = expanded.has(q.attemptId);
                const hasNotes = q.notes != null && q.notes.trim().length > 0;
                const accuracy = realAccuracy(q);
                const accuracyRounded = accuracy != null ? Math.round(accuracy) : null;
                return (
                  <tr key={q.attemptId} className="hover:bg-zinc-50 align-top transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-900 font-medium">
                      {q.year} P{q.paperNumber}
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-700 tabular-nums">
                      Q{q.questionNum}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">
                      <ScoreCell score={q.score} maxMark={q.attemptMaxMark} accuracy={accuracyRounded} />
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-zinc-700">
                      {q.confidence != null ? `${q.confidence}/5` : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {q.mistakeType ? MISTAKE_LABELS[q.mistakeType] ?? q.mistakeType : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-700 max-w-md">
                      {hasNotes ? (
                        <NotesCell notes={q.notes!} expanded={isExpanded} onToggle={() => toggleExpand(q.attemptId)} />
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {q.markedForReview ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-900">
                          ⚑
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                      {formatAttemptDate(q.attemptedAt)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/papers/${q.year}/${q.paperNumber}`}
                          className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                        >
                          Open paper →
                        </Link>
                        {q.msPath && (
                          <a
                            href={`/api/pdf?path=${encodeURIComponent(q.msPath)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                          >
                            Open mark scheme ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function FilterBar({
  years, year, setYear, score, setScore, date, setDate,
  filtersActive, onClear, shownCount, totalCount,
}: {
  years:    number[];
  year:     number | "all";
  setYear:  (y: number | "all") => void;
  score:    ScoreBucket;
  setScore: (s: ScoreBucket) => void;
  date:     DateBucket;
  setDate:  (d: DateBucket) => void;
  filtersActive: boolean;
  onClear:  () => void;
  shownCount: number;
  totalCount: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <FilterSelect label="Year" value={String(year)} onChange={(v) => setYear(v === "all" ? "all" : parseInt(v, 10))}>
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </FilterSelect>

        <FilterSelect label="Score" value={score} onChange={(v) => setScore(v as ScoreBucket)}>
          <option value="all">Any</option>
          <option value="lt50">&lt; 50%</option>
          <option value="mid">50–75%</option>
          <option value="gte75">≥ 75%</option>
          <option value="unscored">Unscored</option>
        </FilterSelect>

        <FilterSelect label="Attempted" value={date} onChange={(v) => setDate(v as DateBucket)}>
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </FilterSelect>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span>
            Showing <span className="font-medium text-zinc-900 tabular-nums">{shownCount}</span> of <span className="tabular-nums">{totalCount}</span>
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, children,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className="font-medium uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function SortHeader({
  label, sortKey, current, dir, onClick, align = "center",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "center";
}) {
  const active = current === sortKey;
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      className={`px-3 py-3 font-medium select-none cursor-pointer hover:text-zinc-900 ${
        align === "left" ? "text-left" : "text-center"
      } ${active ? "text-zinc-900" : ""}`}
      onClick={() => onClick(sortKey)}
    >
      {label} <span className="text-zinc-400">{arrow}</span>
    </th>
  );
}

function ScoreCell({ score, maxMark, accuracy }: { score: number | null; maxMark: number | null; accuracy: number | null }) {
  if (score == null || maxMark == null) return <span className="text-zinc-300">—</span>;
  const tone =
    accuracy == null            ? "text-zinc-700" :
    accuracy >= 75              ? "text-emerald-700" :
    accuracy >= 50              ? "text-amber-700" :
                                  "text-rose-700";
  return (
    <span className={`font-medium ${tone}`}>
      {score}/{maxMark}
      {accuracy != null && (
        <span className="ml-1 text-xs font-normal text-zinc-400">({accuracy}%)</span>
      )}
    </span>
  );
}

function NotesCell({ notes, expanded, onToggle }: { notes: string; expanded: boolean; onToggle: () => void }) {
  const isLong = notes.length > 140;
  if (!isLong) return <span className="whitespace-pre-wrap">{notes}</span>;
  return (
    <div>
      <span className="whitespace-pre-wrap">
        {expanded ? notes : notes.slice(0, 140).trimEnd() + "…"}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="ml-1 text-[11px] text-zinc-500 underline hover:text-zinc-900"
      >
        {expanded ? "less" : "more"}
      </button>
    </div>
  );
}

// ─── Filter predicates (pure, tested) ────────────────────────────────────────

export function matchesYear(q: TopicDetailRow, year: number | "all"): boolean {
  if (year === "all") return true;
  return q.year === year;
}

export function matchesScoreBucket(q: TopicDetailRow, bucket: ScoreBucket): boolean {
  if (bucket === "all") return true;
  if (bucket === "unscored") return q.score == null;
  const acc = realAccuracy(q);
  if (acc == null) return false;
  switch (bucket) {
    case "lt50":  return acc < 50;
    case "mid":   return acc >= 50 && acc < 75;
    case "gte75": return acc >= 75;
  }
}

export function matchesDateBucket(
  q: TopicDetailRow,
  bucket: DateBucket,
  now: number = Date.now(),
): boolean {
  if (bucket === "all") return true;
  const days = bucket === "7d" ? 7 : bucket === "30d" ? 30 : 90;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  // SQLite "YYYY-MM-DD HH:MM:SS" — treat as UTC (datetime('now') default).
  const attemptMs = new Date(q.attemptedAt.replace(" ", "T") + "Z").getTime();
  return attemptMs >= cutoff;
}

// Strict-null accuracy: returns null if score OR attempt's max mark is missing.
// Used by sort and filter so a missing score doesn't masquerade as 0%.
export function realAccuracy(q: TopicDetailRow): number | null {
  if (q.score == null) return null;
  if (q.attemptMaxMark == null || q.attemptMaxMark <= 0) return null;
  return (q.score / q.attemptMaxMark) * 100;
}

// ─── Sort helpers ────────────────────────────────────────────────────────────

export function compare(a: TopicDetailRow, b: TopicDetailRow, key: SortKey): number {
  switch (key) {
    case "paper":
      // Newest paper first when DESC (the default), which feels most useful.
      if (a.year !== b.year) return a.year - b.year;
      if (a.paperNumber !== b.paperNumber) return a.paperNumber.localeCompare(b.paperNumber);
      return a.questionNum - b.questionNum;
    case "score": {
      const accA = realAccuracy(a);
      const accB = realAccuracy(b);
      if (accA == null && accB == null) return 0;
      if (accA == null) return 1;
      if (accB == null) return -1;
      return accA - accB;
    }
    case "confidence":
      if (a.confidence == null && b.confidence == null) return 0;
      if (a.confidence == null) return 1;
      if (b.confidence == null) return -1;
      return a.confidence - b.confidence;
    case "review":
      return Number(a.markedForReview) - Number(b.markedForReview);
    case "attemptedAt":
      return a.attemptedAt.localeCompare(b.attemptedAt);
  }
}

// Render attempt date as YYYY-MM-DD. The attempted_at column is set by SQLite's
// datetime('now') which is UTC; for a date label we can slice the string —
// no timezone math needed at day granularity.
export function formatAttemptDate(iso: string): string {
  return iso.slice(0, 10);
}

// Also export the SortKey union so tests can reference it by name.
export type { SortKey as TopicDetailSortKey };
