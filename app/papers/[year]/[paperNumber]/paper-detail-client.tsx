"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AttemptModal, type AttemptFormData } from "@/app/components/attempt-modal";
import { TopicCombobox } from "@/app/components/topic-combobox";
import type { QuestionStatus, MistakeType } from "@/db/schema";

type HistoryAttempt = {
  id: number;
  score: number | null;
  maxMark: number | null;
  confidence: number | null;
  mistakeType: string | null;
  notes: string | null;
  status: string;
  markedForReview: number;
  attemptedAt: string;
};

export type QuestionWithAttempt = {
  id: number;
  questionNum: number;
  topic: string | null;
  subtopic: string | null;
  maxMark: number | null;
  status: string | null;
  score: number | null;
  confidence: number | null;
  mistakeType: string | null;
  markedForReview: number | null;
  attemptedAt: string | null;
};

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    not_started: "bg-zinc-100 text-zinc-500",
    attempted: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    review_needed: "bg-amber-100 text-amber-700",
  };
  const label: Record<string, string> = {
    not_started: "Not started",
    attempted: "Attempted",
    completed: "Completed",
    review_needed: "Review",
  };
  const key = status ?? "not_started";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[key] ?? map.not_started}`}>
      {label[key] ?? "Not started"}
    </span>
  );
}

function QuestionRow({
  question,
  onSaveField,
  onLogClick,
  onEditClick,
  onDeleteClick,
  onDeleteQuestion,
  topicSuggestions,
}: {
  question: QuestionWithAttempt;
  onSaveField: (qId: number, field: string, value: string | number | null) => void;
  onLogClick: (question: QuestionWithAttempt) => void;
  onEditClick: (attempt: HistoryAttempt, question: QuestionWithAttempt) => void;
  onDeleteClick: (attemptId: number, question: QuestionWithAttempt) => void;
  onDeleteQuestion: (questionId: number) => void;
  topicSuggestions: string[];
}) {
  const [topic, setTopic] = useState(question.topic ?? "");
  const [maxMark, setMaxMark] = useState(question.maxMark?.toString() ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  function debounced(qId: number, field: string, value: string | number | null) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSaveField(qId, field, value);
    }, 600);
  }

  function scoreDisplay() {
    if (question.score === null) return "—";
    return question.maxMark ? `${question.score}/${question.maxMark}` : `${question.score}`;
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/questions/${question.id}/attempts`);
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
    setHistoryLoading(false);
    setHistoryOpen(true);
  }

  return (
    <>
      <tr className="hover:bg-zinc-50 transition-colors group">
        <td className="px-4 py-2.5 font-medium text-zinc-900 text-sm">
          <div className="flex items-center gap-1">
            {question.attemptedAt && (
              <button
                onClick={toggleHistory}
                className="text-zinc-400 hover:text-zinc-600 text-xs w-4"
                title="Show attempt history"
              >
                {historyOpen ? "▼" : "▶"}
              </button>
            )}
            {question.questionNum}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <TopicCombobox
            value={topic}
            onChange={(val) => {
              setTopic(val);
              debounced(question.id, "topic", val || null);
            }}
            suggestions={topicSuggestions}
          />
        </td>
        <td className="px-4 py-2.5">
          <input
            type="number"
            value={maxMark}
            onChange={(e) => {
              setMaxMark(e.target.value);
              debounced(question.id, "maxMark", e.target.value ? parseInt(e.target.value, 10) : null);
            }}
            className="w-16 rounded border-0 bg-transparent text-sm text-zinc-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 px-1 py-0.5 -ml-1"
            placeholder="—"
            min={1}
          />
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge status={question.status} />
          {question.markedForReview ? (
            <span className="ml-1.5 text-xs text-amber-500" title="Marked for review">
              ⚑
            </span>
          ) : null}
        </td>
        <td className="px-4 py-2.5 text-sm text-zinc-600">{scoreDisplay()}</td>
        <td className="px-4 py-2.5 text-sm">
          {question.confidence ? (
            <span className="text-zinc-600">{question.confidence}/5</span>
          ) : (
            <span className="text-zinc-300">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onDeleteQuestion(question.id)}
              className="text-xs font-medium text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            >
              Delete
            </button>
            <button
              onClick={() => onLogClick(question)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            >
              Log attempt
            </button>
          </div>
        </td>
      </tr>
      {historyOpen && (
        <tr>
          <td colSpan={7} className="px-4 py-2 bg-zinc-50/50">
            {historyLoading ? (
              <p className="text-xs text-zinc-400">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-zinc-400">No attempts yet.</p>
            ) : (
              <div className="space-y-1 ml-5">
                {history.map((a, i) => {
                  const prev = history[i + 1];
                  const improved = prev && a.maxMark && prev.maxMark && a.maxMark > 0 && prev.maxMark > 0
                    ? (a.score ?? 0) / a.maxMark > (prev.score ?? 0) / prev.maxMark
                    : null;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 text-xs rounded px-1 -mx-1 py-0.5 hover:bg-indigo-50 transition-colors group/hist"
                    >
                      <button
                        onClick={() => onEditClick(a, question)}
                        className="flex items-center gap-3 flex-1 text-left cursor-pointer"
                      >
                        <span className="text-zinc-400 w-20">{new Date(a.attemptedAt).toLocaleDateString()}</span>
                        <span className={`font-medium ${
                          improved === true ? "text-green-600" : improved === false ? "text-red-600" : "text-zinc-600"
                        }`}>
                          {a.score != null && a.maxMark != null ? `${a.score}/${a.maxMark}` : "—"}
                        </span>
                        {a.confidence != null && <span className="text-zinc-400">Conf: {a.confidence}/5</span>}
                        {a.mistakeType && a.mistakeType !== "none" && (
                          <span className="text-amber-600 capitalize">{a.mistakeType.replace("_", " ")}</span>
                        )}
                      </button>
                      <span className="opacity-0 group-hover/hist:opacity-100 flex items-center gap-1.5 ml-auto shrink-0">
                        <span className="text-indigo-400 text-[10px] cursor-pointer" onClick={() => onEditClick(a, question)}>Edit</span>
                        <span
                          className="text-red-400 hover:text-red-600 text-[10px] cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onDeleteClick(a.id, question); }}
                        >
                          Delete
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function PaperDetailClient({
  paperId,
  questions: initial,
}: {
  paperId: number;
  questions: QuestionWithAttempt[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionWithAttempt[]>(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ questionNum: "", topic: "", maxMark: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Topic suggestions (fetched once)
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/topics").then((r) => r.json()).then(setTopicSuggestions).catch(() => {});
  }, []);

  // Attempt modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<QuestionWithAttempt | null>(null);
  const [editingAttemptId, setEditingAttemptId] = useState<number | null>(null);
  const [editInitialData, setEditInitialData] = useState<AttemptFormData | null>(null);

  // Keyboard shortcut: Enter opens attempt modal for next unattempted question
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || modalOpen || adding) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return;

      const next = questions.find((q) => q.status === null || q.status === "not_started")
        ?? questions[0];
      if (next) {
        setActiveQuestion(next);
        setModalOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [questions, modalOpen, adding]);

  // Debounced field save — fire-and-forget
  const saveField = useCallback(async (qId: number, field: string, value: string | number | null) => {
    await fetch(`/api/questions/${qId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }, []);

  function openModal(question: QuestionWithAttempt) {
    setActiveQuestion(question);
    setEditingAttemptId(null);
    setEditInitialData(null);
    setModalOpen(true);
  }

  function openEditModal(attempt: HistoryAttempt, question: QuestionWithAttempt) {
    setActiveQuestion(question);
    setEditingAttemptId(attempt.id);
    setEditInitialData({
      status: attempt.status as QuestionStatus,
      score: attempt.score,
      maxMark: attempt.maxMark,
      confidence: attempt.confidence,
      mistakeType: (attempt.mistakeType as MistakeType) ?? null,
      notes: attempt.notes ?? "",
      markedForReview: attempt.markedForReview === 1,
    });
    setModalOpen(true);
  }

  async function handleDeleteAttempt(attemptId: number, question: QuestionWithAttempt) {
    if (!confirm("Delete this attempt? This cannot be undone.")) return;

    const res = await fetch(`/api/attempts/${attemptId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.questionDeleted) {
        // Question was auto-deleted because no attempts remain
        setQuestions((prev) => prev.filter((q) => q.id !== question.id));
      }
      router.refresh();
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!confirm("Delete this question and all its attempts? This cannot be undone.")) return;

    const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      router.refresh();
    }
  }

  async function handleEditAttempt(data: AttemptFormData) {
    if (!activeQuestion || !editingAttemptId) return;

    const res = await fetch(`/api/attempts/${editingAttemptId}`, {
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
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id
            ? {
                ...q,
                status: data.status,
                score: data.score,
                maxMark: data.maxMark ?? q.maxMark,
                confidence: data.confidence,
                mistakeType: data.mistakeType,
                markedForReview: data.markedForReview ? 1 : 0,
              }
            : q
        )
      );
      setModalOpen(false);
      setActiveQuestion(null);
      setEditingAttemptId(null);
      setEditInitialData(null);
      router.refresh();
    }
  }

  async function handleLogAttempt(data: AttemptFormData) {
    if (!activeQuestion) return;

    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: activeQuestion.id,
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
      // Optimistic update: reflect new attempt data immediately without a full page refresh
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id
            ? {
                ...q,
                status: data.status,
                score: data.score,
                maxMark: data.maxMark ?? q.maxMark,
                confidence: data.confidence,
                mistakeType: data.mistakeType,
                markedForReview: data.markedForReview ? 1 : 0,
                attemptedAt: new Date().toISOString(),
              }
            : q
        )
      );
      setModalOpen(false);
      setActiveQuestion(null);
      // Refresh server component to update progress bar / health score
      router.refresh();
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = parseInt(form.questionNum, 10);
    if (isNaN(num) || num < 1) {
      setError("Enter a valid question number");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/papers/${paperId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionNum: num,
        topic: form.topic || undefined,
        maxMark: form.maxMark ? parseInt(form.maxMark, 10) : undefined,
      }),
    });
    setSubmitting(false);
    if (res.status === 409) {
      setError(`Question ${num} already exists in this paper`);
      return;
    }
    if (!res.ok) {
      setError("Failed to add question");
      return;
    }
    const inserted = await res.json();
    // Optimistically add the new question to local state so it appears immediately
    setQuestions((prev) => [
      ...prev,
      {
        id: inserted.id,
        questionNum: inserted.questionNum,
        topic: inserted.topic ?? null,
        subtopic: inserted.subtopic ?? null,
        maxMark: inserted.maxMark ?? null,
        status: null,
        score: null,
        confidence: null,
        mistakeType: null,
        markedForReview: null,
        attemptedAt: null,
      },
    ]);
    setForm({ questionNum: "", topic: "", maxMark: "" });
    setAdding(false);
    router.refresh();
  }

  return (
    <div>
      {questions.length === 0 && !adding ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-zinc-500 mb-4">No questions yet. Add your first question to start tracking.</p>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + Add question
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left bg-zinc-50">
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide w-14">Q#</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Topic</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide w-24">Max marks</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide w-32">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide w-24">Score</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide w-16">Conf</th>
                  <th className="px-4 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {questions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    onSaveField={saveField}
                    onLogClick={openModal}
                    onEditClick={openEditModal}
                    onDeleteClick={handleDeleteAttempt}
                    onDeleteQuestion={handleDeleteQuestion}
                    topicSuggestions={topicSuggestions}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!adding && (
            <div className="mt-3">
              <button
                onClick={() => setAdding(true)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Add question
              </button>
            </div>
          )}
        </>
      )}

      {adding && (
        <form
          onSubmit={handleAdd}
          className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Question #</label>
            <input
              type="number"
              min={1}
              required
              value={form.questionNum}
              onChange={(e) => setForm({ ...form, questionNum: e.target.value })}
              className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="1"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Topic (optional)</label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              className="w-48 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. Thermodynamics"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Max marks (optional)</label>
            <input
              type="number"
              min={1}
              value={form.maxMark}
              onChange={(e) => setForm({ ...form, maxMark: e.target.value })}
              className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="10"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
          </div>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}

      {activeQuestion && (
        <AttemptModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setActiveQuestion(null);
            setEditingAttemptId(null);
            setEditInitialData(null);
          }}
          questionNum={activeQuestion.questionNum}
          topic={activeQuestion.topic}
          defaultMaxMark={activeQuestion.maxMark}
          onSubmit={editingAttemptId ? handleEditAttempt : handleLogAttempt}
          initialData={editInitialData ?? undefined}
        />
      )}
    </div>
  );
}
