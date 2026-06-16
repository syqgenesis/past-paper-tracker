"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TopicIndexRow } from "@/lib/analytics";

type SortKey = "topic" | "attempted" | "accuracy" | "review" | "lastAttempted";
type SortDir = "asc" | "desc";

interface Props {
  rows: TopicIndexRow[];
}

export function TopicsClient({ rows }: Props) {
  const router = useRouter();
  // Default: weakest first (accuracy ASC, nulls last). Mirrors how the user wants
  // to triage — "what am I worst at" is the load-bearing question.
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Relative timestamps depend on Date.now(); avoid hydration mismatch by
  // rendering a static date during SSR and filling in "Nd ago" after mount.
  // Pattern matches the v1.5 ISSUE-002 fix in the (removed) plan-client.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible defaults: text ASC, numbers DESC (except accuracy which we want weakest-first)
      setSortDir(key === "topic" || key === "accuracy" ? "asc" : "desc");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        No topics yet. Tag questions with a topic from the paper detail page.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <SortHeader label="Topic"          sortKey="topic"         current={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
            <SortHeader label="Attempted"      sortKey="attempted"     current={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Accuracy"       sortKey="accuracy"      current={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="In Review"      sortKey="review"        current={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Last Attempted" sortKey="lastAttempted" current={sortKey} dir={sortDir} onClick={toggleSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sorted.map((row) => (
            <tr
              key={row.slug}
              onClick={(e) => {
                // Let the inner <Link> handle its own click — avoids double-navigation
                // and preserves right-click + Cmd-click semantics on the link itself.
                if ((e.target as HTMLElement).closest("a")) return;
                // Shift-click is for text selection — don't hijack it.
                if (e.shiftKey) return;
                // Cmd/Ctrl click on empty row space → open in new tab,
                // matching the affordance the inner Link already provides.
                if (e.metaKey || e.ctrlKey) {
                  window.open(`/topics/${row.slug}`, "_blank");
                  return;
                }
                router.push(`/topics/${row.slug}`);
              }}
              className="cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              <td className="px-4 py-3">
                {/* Inner Link is the load-bearing affordance for keyboard nav,
                    right-click "Open in new tab", and screen readers. */}
                <Link href={`/topics/${row.slug}`} className="font-medium text-zinc-900 hover:underline">
                  {row.topic}
                </Link>
              </td>
              <td className="px-4 py-3 text-center text-zinc-700 tabular-nums">
                {row.attemptedQuestions}<span className="text-zinc-400"> / {row.totalQuestions}</span>
              </td>
              <td className="px-4 py-3 text-center tabular-nums">
                <AccuracyBadge value={row.avgAccuracy} />
              </td>
              <td className="px-4 py-3 text-center tabular-nums">
                {row.reviewCount > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[1.75rem] rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    {row.reviewCount}
                  </span>
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-xs text-zinc-500 tabular-nums" suppressHydrationWarning>
                {mounted ? formatRelative(row.lastAttempted) : formatAbsolute(row.lastAttempted)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

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
      className={`px-4 py-3 font-medium select-none cursor-pointer hover:text-zinc-900 ${
        align === "left" ? "text-left" : "text-center"
      } ${active ? "text-zinc-900" : ""}`}
      onClick={() => onClick(sortKey)}
    >
      {label} <span className="text-zinc-400">{arrow}</span>
    </th>
  );
}

function AccuracyBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-300">—</span>;
  const tone =
    value >= 75 ? "bg-emerald-100 text-emerald-900" :
    value >= 50 ? "bg-amber-100 text-amber-900" :
                  "bg-rose-100 text-rose-900";
  return (
    <span className={`inline-block min-w-[3rem] rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
      {value}%
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compare(a: TopicIndexRow, b: TopicIndexRow, key: SortKey): number {
  switch (key) {
    case "topic":
      return a.topic.localeCompare(b.topic);
    case "attempted":
      return a.attemptedQuestions - b.attemptedQuestions;
    case "accuracy":
      // Nulls last regardless of direction
      if (a.avgAccuracy == null && b.avgAccuracy == null) return 0;
      if (a.avgAccuracy == null) return 1;
      if (b.avgAccuracy == null) return -1;
      return a.avgAccuracy - b.avgAccuracy;
    case "review":
      return a.reviewCount - b.reviewCount;
    case "lastAttempted":
      if (a.lastAttempted == null && b.lastAttempted == null) return 0;
      if (a.lastAttempted == null) return 1;
      if (b.lastAttempted == null) return -1;
      return a.lastAttempted.localeCompare(b.lastAttempted);
  }
}

export function formatRelative(iso: string | null, now: number = Date.now()): string {
  if (iso == null) return "—";
  // SQLite returns "YYYY-MM-DD HH:MM:SS" without a Z. Treat as UTC since
  // attempted_at defaults to datetime('now') which is UTC.
  const date = new Date(iso.replace(" ", "T") + "Z");
  const diffMs = now - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// SSR fallback — pure function of the input string, no Date.now() involvement.
export function formatAbsolute(iso: string | null): string {
  if (iso == null) return "—";
  return iso.slice(0, 10); // YYYY-MM-DD
}
