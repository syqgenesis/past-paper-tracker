"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import type { QuestionStatus, MistakeType } from "@/db/schema";

export type AttemptFormData = {
  status: QuestionStatus;
  score: number | null;
  maxMark: number | null;
  confidence: number | null;
  mistakeType: MistakeType | null;
  notes: string;
  markedForReview: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  questionNum: number;
  topic: string | null;
  defaultMaxMark: number | null;
  onSubmit: (data: AttemptFormData) => Promise<void>;
  /** When provided, modal enters edit mode with pre-filled values */
  initialData?: AttemptFormData;
};

const MISTAKE_TYPES: { value: MistakeType | ""; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "conceptual", label: "Conceptual gap" },
  { value: "calculation", label: "Calculation error" },
  { value: "misread", label: "Misread question" },
  { value: "forgot_formula", label: "Forgot formula" },
  { value: "time_pressure", label: "Time pressure" },
  { value: "careless", label: "Careless slip" },
  { value: "none", label: "No mistake" },
];

const STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = [
  { value: "attempted", label: "Attempted" },
  { value: "completed", label: "Completed" },
  { value: "review_needed", label: "Needs review" },
];

export function AttemptModal({ open, onClose, questionNum, topic, defaultMaxMark, onSubmit, initialData }: Props) {
  const [score, setScore] = useState("");
  const [maxMark, setMaxMark] = useState(defaultMaxMark?.toString() ?? "");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [mistakeType, setMistakeType] = useState<MistakeType | "">("");
  const [notes, setNotes] = useState("");
  const [markedForReview, setMarkedForReview] = useState(false);
  const [status, setStatus] = useState<QuestionStatus>("attempted");
  const [submitting, setSubmitting] = useState(false);

  // Auto-suggest mark for review when score < 50% of max (only in create mode)
  useEffect(() => {
    if (initialData) return;
    const s = parseFloat(score);
    const m = parseFloat(maxMark);
    if (!isNaN(s) && !isNaN(m) && m > 0) {
      setMarkedForReview(s / m < 0.5);
    }
  }, [score, maxMark, initialData]);

  // Reset form when modal opens — populate from initialData if editing
  useEffect(() => {
    if (open) {
      if (initialData) {
        setScore(initialData.score != null ? String(initialData.score) : "");
        setMaxMark(initialData.maxMark != null ? String(initialData.maxMark) : (defaultMaxMark?.toString() ?? ""));
        setConfidence(initialData.confidence);
        setMistakeType(initialData.mistakeType ?? "");
        setNotes(initialData.notes);
        setMarkedForReview(initialData.markedForReview);
        setStatus(initialData.status);
      } else {
        setScore("");
        setMaxMark(defaultMaxMark?.toString() ?? "");
        setConfidence(null);
        setMistakeType("");
        setNotes("");
        setMarkedForReview(false);
        setStatus("attempted");
      }
    }
  }, [open, defaultMaxMark, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      status,
      score: score !== "" ? parseFloat(score) : null,
      maxMark: maxMark !== "" ? parseFloat(maxMark) : null,
      confidence,
      mistakeType: mistakeType || null,
      notes,
      markedForReview,
    });
    setSubmitting(false);
  }

  const scoreNum = parseFloat(score);
  const maxNum = parseFloat(maxMark);
  const isLowScore = !isNaN(scoreNum) && !isNaN(maxNum) && maxNum > 0 && scoreNum / maxNum < 0.5;
  const isEditMode = !!initialData;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-xl p-6 focus:outline-none">
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-900">
                {isEditMode ? "Edit attempt" : "Log attempt"} — Q{questionNum}
              </Dialog.Title>
              {topic && (
                <p className="text-xs text-zinc-400 mt-0.5">{topic}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 text-xl leading-none mt-0.5"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Score row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 mb-1">Score</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 mb-1">Out of</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={maxMark}
                  onChange={(e) => setMaxMark(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex-1 rounded-lg border text-xs py-1.5 font-medium transition-colors ${
                      status === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Confidence</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfidence(confidence === n ? null : n)}
                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                      confidence === n
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-zinc-200 text-zinc-400 hover:border-indigo-300 hover:text-indigo-500"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="ml-1 self-center text-xs text-zinc-400">
                  {confidence ? ["", "Very unsure", "Unsure", "OK", "Confident", "Nailed it"][confidence] : ""}
                </span>
              </div>
            </div>

            {/* Mistake type */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Mistake type</label>
              <select
                value={mistakeType}
                onChange={(e) => setMistakeType(e.target.value as MistakeType | "")}
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {MISTAKE_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="What went wrong? What to remember next time…"
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Mark for review */}
            <label className={`flex items-start gap-2.5 rounded-lg p-3 border cursor-pointer transition-colors ${
              markedForReview ? "border-amber-300 bg-amber-50" : "border-zinc-200 hover:border-zinc-300"
            }`}>
              <input
                type="checkbox"
                checked={markedForReview}
                onChange={(e) => setMarkedForReview(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">Add to review queue</p>
                {!isEditMode && isLowScore && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    That was tough — pre-ticked because score &lt; 50%
                  </p>
                )}
              </div>
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Saving…" : isEditMode ? "Save changes" : "Log attempt"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
