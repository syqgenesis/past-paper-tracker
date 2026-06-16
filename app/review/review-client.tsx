"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ReviewItem } from "@/lib/analytics";
import { AttemptModal, type AttemptFormData } from "@/app/components/attempt-modal";
import type { QuestionStatus, MistakeType } from "@/db/schema";

type SortKey = "date" | "accuracy" | "topic";

interface FilterOptions {
  topics:       string[];
  years:        number[];
  paperNumbers: string[];
  mistakeTypes: string[];
}

interface Props {
  items:         ReviewItem[];
  filterOptions: FilterOptions;
}

const MISTAKE_LABELS: Record<string, string> = {
  conceptual:     "Conceptual",
  calculation:    "Calculation",
  misread:        "Misread",
  forgot_formula: "Forgot formula",
  time_pressure:  "Time pressure",
  careless:       "Careless",
  none:           "None",
};

export function ReviewClient({ items: initial, filterOptions }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [topic, setTopic] = useState("");
  const [year, setYear] = useState("");
  const [paperNumber, setPaperNumber] = useState("");
  const [mistakeType, setMistakeType] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = items;
    if (topic)       result = result.filter((i) => i.topic?.toLowerCase() === topic.toLowerCase());
    if (year)        result = result.filter((i) => i.year === parseInt(year, 10));
    if (paperNumber) result = result.filter((i) => i.paperNumber === paperNumber);
    if (mistakeType) result = result.filter((i) => i.mistakeType === mistakeType);
    return result;
  }, [items, topic, year, paperNumber, mistakeType]);

  // Sorting
  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortBy) {
      case "date":
        return copy.sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
      case "accuracy":
        return copy.sort((a, b) => {
          const accA = a.maxMark && a.maxMark > 0 ? (a.score ?? 0) / a.maxMark : 999;
          const accB = b.maxMark && b.maxMark > 0 ? (b.score ?? 0) / b.maxMark : 999;
          return accA - accB;
        });
      case "topic":
        return copy.sort((a, b) => (a.topic ?? "").localeCompare(b.topic ?? ""));
      default:
        return copy;
    }
  }, [filtered, sortBy]);

  // Stats
  const mistakeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = item.mistakeType ?? "unset";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  async function handleDismiss(item: ReviewItem) {
    setDismissing((prev) => new Set(prev).add(item.attemptId));
    setError(null);

    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.attemptId !== item.attemptId));

    try {
      const res = await fetch(`/api/attempts/${item.attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markedForReview: false, status: "attempted" }),
      });

      if (!res.ok) throw new Error("Failed to dismiss");
      router.refresh();
    } catch {
      // Re-add item on error
      setItems((prev) => [...prev, item]);
      setError(`Failed to dismiss Q${item.questionNum} — try again.`);
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(item.attemptId);
        return next;
      });
    }
  }

  function openEdit(item: ReviewItem) {
    setEditingItem(item);
    setEditModalOpen(true);
  }

  async function handleEditSubmit(data: AttemptFormData) {
    if (!editingItem) return;

    const res = await fetch(`/api/attempts/${editingItem.attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: data.status,
        score: data.score,
        maxMark: data.maxMark,
        confidence: data.confidence,
        mistakeType: data.mistakeType,
        notes: data.notes || null,
        markedForReview: data.markedForReview,
      }),
    });

    if (res.ok) {
      if (!data.markedForReview) {
        setItems((prev) => prev.filter((i) => i.attemptId !== editingItem.attemptId));
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.attemptId === editingItem.attemptId
              ? { ...i, score: data.score, maxMark: data.maxMark, confidence: data.confidence, mistakeType: data.mistakeType, notes: data.notes || null, status: data.status }
              : i
          )
        );
      }
      setEditModalOpen(false);
      setEditingItem(null);
      router.refresh();
    }
  }

  async function handleDelete(item: ReviewItem) {
    if (!confirm(`Delete attempt for Q${item.questionNum}? This cannot be undone.`)) return;

    const res = await fetch(`/api/attempts/${item.attemptId}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.attemptId !== item.attemptId));
      router.refresh();
    }
  }

  function relativeDate(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return `${diff} days ago`;
    if (diff < 30)  return `${Math.floor(diff / 7)} week${Math.floor(diff / 7) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diff / 30)} month${Math.floor(diff / 30) > 1 ? "s" : ""} ago`;
  }

  function accuracyColor(score: number | null, maxMark: number | null): string {
    if (score == null || maxMark == null || maxMark === 0) return "text-zinc-400";
    const pct = (score / maxMark) * 100;
    if (pct >= 70) return "text-green-600";
    if (pct >= 50) return "text-amber-600";
    return "text-red-600";
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-lg font-medium text-zinc-900 mb-2">All caught up!</h2>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">
          No questions are flagged for review. Head to{" "}
          <a href="/papers" className="text-indigo-600 underline underline-offset-2">
            Papers
          </a>{" "}
          to keep practising.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-zinc-900">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        <span className="text-zinc-300">|</span>
        {Object.entries(mistakeBreakdown).map(([type, count]) => (
          <span key={type} className="text-xs text-zinc-500">
            {MISTAKE_LABELS[type] ?? type}: {count}
          </span>
        ))}
      </div>

      {/* Filter bar + sort */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Topic" value={topic} onChange={setTopic} options={filterOptions.topics.map((t) => ({ value: t, label: capitalize(t) }))} />
        <FilterSelect label="Year" value={year} onChange={setYear} options={filterOptions.years.map((y) => ({ value: String(y), label: String(y) }))} />
        <FilterSelect label="Paper" value={paperNumber} onChange={setPaperNumber} options={filterOptions.paperNumbers.map((p) => ({ value: p, label: `Paper ${p}` }))} />
        <FilterSelect label="Mistake" value={mistakeType} onChange={setMistakeType} options={filterOptions.mistakeTypes.map((m) => ({ value: m, label: MISTAKE_LABELS[m] ?? m }))} />

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">Sort:</span>
          {(["date", "accuracy", "topic"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sortBy === key
                  ? "bg-indigo-100 text-indigo-700 font-medium"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {key === "date" ? "Oldest" : key === "accuracy" ? "Worst" : "Topic"}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Items */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-400">No items match your filters.</p>
          <button
            onClick={() => { setTopic(""); setYear(""); setPaperNumber(""); setMistakeType(""); }}
            className="text-xs text-indigo-600 hover:underline mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item.attemptId}
              className="rounded-xl border border-zinc-200 bg-white p-4 flex items-start justify-between gap-4 hover:border-zinc-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/papers/${item.year}/${item.paperNumber}`}
                    className="text-sm font-medium text-zinc-900 hover:text-indigo-600 transition-colors"
                  >
                    {item.year} Paper {item.paperNumber} Q{item.questionNum}
                  </a>
                  {item.topic && (
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 capitalize">
                      {item.topic}
                    </span>
                  )}
                  {item.mistakeType && item.mistakeType !== "none" && (
                    <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                      {MISTAKE_LABELS[item.mistakeType] ?? item.mistakeType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                  {item.score != null && item.maxMark != null && (
                    <span className={`font-medium ${accuracyColor(item.score, item.maxMark)}`}>
                      {item.score}/{item.maxMark}
                    </span>
                  )}
                  {item.confidence != null && (
                    <span>Conf: {item.confidence}/5</span>
                  )}
                  <span>{relativeDate(item.attemptedAt)}</span>
                </div>

                {item.notes && (
                  <p className="text-xs text-zinc-400 mt-1 truncate max-w-md">
                    {item.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(item)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <a
                  href={`/papers/${item.year}/${item.paperNumber}`}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition-colors"
                >
                  Go to paper
                </a>
                <button
                  onClick={() => handleDismiss(item)}
                  disabled={dismissing.has(item.attemptId)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {dismissing.has(item.attemptId) ? "..." : "Dismiss"}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <AttemptModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingItem(null);
          }}
          questionNum={editingItem.questionNum}
          topic={editingItem.topic}
          defaultMaxMark={editingItem.maxMark}
          onSubmit={handleEditSubmit}
          initialData={{
            status: editingItem.status as QuestionStatus,
            score: editingItem.score,
            maxMark: editingItem.maxMark,
            confidence: editingItem.confidence,
            mistakeType: (editingItem.mistakeType as MistakeType) ?? null,
            notes: editingItem.notes ?? "",
            markedForReview: true,
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  options:  { value: string; label: string }[];
}) {
  if (options.length === 0) return null;
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-zinc-400 mb-0.5">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
