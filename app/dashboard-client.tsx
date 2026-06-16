"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import type {
  DashboardStats,
  TopicAccuracy,
  ColdTopic,
  ActivityEntry,
  WeakTopic,
  WeeklyProgress,
  ReviewItem,
  QuestionCounts,
} from "@/lib/analytics";
import type { SessionStats } from "@/lib/session-tracker";

interface Props {
  stats:           DashboardStats;
  accuracyByTopic: TopicAccuracy[];
  coldTopics:      ColdTopic[];
  activity:        ActivityEntry[];
  weakTopics:      WeakTopic[];
  weeklyProgress:  WeeklyProgress[];
  streak:          number;
  reviewPreview:   ReviewItem[];
  questionCounts:  QuestionCounts;
  sessionStats:    SessionStats;
}

export default function DashboardClient({
  stats,
  accuracyByTopic,
  coldTopics,
  activity,
  weakTopics,
  weeklyProgress,
  streak,
  reviewPreview,
  questionCounts,
  sessionStats,
}: Props) {
  const [examDate, setExamDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    setExamDate(localStorage.getItem("examDate") ?? "");
  }, []);

  function saveExamDate(date: string) {
    setExamDate(date);
    if (date) {
      localStorage.setItem("examDate", date);
    } else {
      localStorage.removeItem("examDate");
    }
    setShowDatePicker(false);
  }

  // Exam countdown
  let daysRemaining:   number | null = null;
  let questionsPerDay: number | null = null;
  if (examDate) {
    const diff = Math.ceil(
      (new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (diff > 0) {
      daysRemaining   = diff;
      questionsPerDay =
        questionCounts.unattempted > 0
          ? Math.ceil(questionCounts.unattempted / diff)
          : 0;
    }
  }

  const isEmpty = stats.totalQuestionsAttempted === 0;

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
        <div className="text-4xl mb-4">🧪</div>
        <h2 className="text-lg font-medium text-zinc-900 mb-2">No attempts yet</h2>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">
          Head to{" "}
          <a href="/settings" className="text-indigo-600 underline underline-offset-2">
            Settings
          </a>{" "}
          to scan your papers, then open a paper and log your first attempt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Questions Attempted" value={stats.totalQuestionsAttempted} />
        <StatCard
          label="Overall Accuracy"
          value={stats.overallAccuracy != null ? `${stats.overallAccuracy}%` : "—"}
          accent={stats.overallAccuracy != null ? accuracyColor(stats.overallAccuracy) : undefined}
        />
        <StatCard
          label="Avg Confidence"
          value={stats.avgConfidence != null ? `${stats.avgConfidence}/5` : "—"}
        />
        <StatCard label="Papers Touched" value={stats.totalPapersTouched} />
        <StatCard
          label="Study Streak"
          value={streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "—"}
          accent={streak >= 7 ? "text-green-600" : streak >= 3 ? "text-amber-600" : undefined}
        />
      </div>

      {/* ── Session stats (derived from attempt timestamps) ──────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Today"
          value={sessionStats.todayMinutes > 0 ? `${sessionStats.todayMinutes}m` : "—"}
        />
        <StatCard
          label="This Week"
          value={sessionStats.last7dMinutes > 0
            ? `${Math.round((sessionStats.last7dMinutes / 60) * 10) / 10}h`
            : "—"}
        />
        <StatCard
          label="Sessions (7d)"
          value={sessionStats.sessionsLast7d > 0 ? String(sessionStats.sessionsLast7d) : "—"}
        />
        <StatCard
          label="Avg Session"
          value={sessionStats.avgSessionDurationMin != null
            ? `${sessionStats.avgSessionDurationMin}m`
            : "—"}
        />
      </div>

      {/* ── Exam countdown + cold topics ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          {daysRemaining != null ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                  Exam Countdown
                </p>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  Change
                </button>
              </div>
              <p className="text-3xl font-bold text-indigo-700">{daysRemaining} days</p>
              {questionsPerDay != null && questionCounts.unattempted > 0 && (
                <p className="text-sm text-indigo-600 mt-1">
                  ~{questionsPerDay} questions/day to finish {questionCounts.unattempted} remaining
                </p>
              )}
              {questionCounts.unattempted === 0 && (
                <p className="text-sm text-indigo-600 mt-1">All questions attempted!</p>
              )}
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-indigo-500 mb-1">
                  <span>{questionCounts.attempted} done</span>
                  <span>{questionCounts.total} total</span>
                </div>
                <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${questionCounts.total > 0 ? (questionCounts.attempted / questionCounts.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-2">
                Exam Countdown
              </p>
              <p className="text-sm text-indigo-600 mb-3">Set your exam date to see a countdown and daily target.</p>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-sm font-medium text-indigo-700 hover:text-indigo-900 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition-colors"
              >
                Set exam date
              </button>
            </>
          )}
          {showDatePicker && (
            <DatePickerRow
              defaultValue={examDate}
              onSave={saveExamDate}
              onClear={examDate ? () => saveExamDate("") : undefined}
            />
          )}
          {/* date picker rendered above via DatePickerRow */}
        </div>

        {coldTopics.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
              Cold Topics <span className="normal-case font-normal">(not touched in 7+ days)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {coldTopics.map((t) => (
                <span
                  key={t.topic}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                >
                  <span className="capitalize">{t.topic}</span>
                  <span className="text-amber-500">{t.daysSince}d</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">
              Cold Topics
            </p>
            <p className="text-sm text-green-600">All topics touched recently. Nice work!</p>
          </div>
        )}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-900 mb-4">Activity — last 30 days</h2>
          <ActivityChart data={activity} />
        </div>

        {weeklyProgress.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900 mb-4">Weekly Accuracy Trend</h2>
            <WeeklyProgressChart data={weeklyProgress} />
          </div>
        ) : accuracyByTopic.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900 mb-4">Accuracy by Topic</h2>
            <TopicChart data={accuracyByTopic} />
          </div>
        ) : null}
      </div>

      {/* ── Topic accuracy (if weekly progress took the slot above) ──────── */}
      {weeklyProgress.length > 0 && accuracyByTopic.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-900 mb-4">Accuracy by Topic</h2>
          <TopicChart data={accuracyByTopic} />
        </div>
      )}

      {/* ── Weak topics + review preview ──────────────────────────────────── */}
      {(weakTopics.length > 0 || reviewPreview.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {weakTopics.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-medium text-zinc-900 mb-4">
                Weak Topics{" "}
                <span className="text-zinc-400 font-normal text-xs">(&lt;60% accuracy)</span>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100">
                    <th className="pb-2 font-medium">Topic</th>
                    <th className="pb-2 font-medium text-right">Accuracy</th>
                    <th className="pb-2 font-medium text-right">Qs</th>
                  </tr>
                </thead>
                <tbody>
                  {weakTopics.map((t) => (
                    <tr key={t.topic} className="border-b border-zinc-50 last:border-0">
                      <td className="py-2 capitalize">{t.topic}</td>
                      <td className="py-2 text-right font-medium text-red-600">
                        {t.avgAccuracy != null ? `${Math.round(t.avgAccuracy)}%` : "—"}
                      </td>
                      <td className="py-2 text-right text-zinc-400">{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reviewPreview.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-zinc-900">Review Queue</h2>
                <a href="/review" className="text-xs text-indigo-600 hover:underline">
                  View all
                </a>
              </div>
              <div className="space-y-1.5">
                {reviewPreview.map((item) => (
                  <a
                    key={item.attemptId}
                    href={`/papers/${item.year}/${item.paperNumber}`}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 hover:bg-zinc-100 px-3 py-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-zinc-800">
                        {item.year} Paper {item.paperNumber} Q{item.questionNum}
                      </span>
                      {item.topic && (
                        <span className="ml-2 text-xs text-zinc-400 capitalize">
                          {item.topic}
                        </span>
                      )}
                    </div>
                    {item.score != null && item.maxMark != null && (
                      <span className="text-sm font-medium text-red-600 shrink-0 ml-2">
                        {item.score}/{item.maxMark}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DatePickerRow({
  defaultValue,
  onSave,
  onClear,
}: {
  defaultValue: string;
  onSave: (date: string) => void;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        ref={inputRef}
        type="date"
        defaultValue={defaultValue}
        min={new Date().toISOString().split("T")[0]}
        className="rounded-lg border border-indigo-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave((e.target as HTMLInputElement).value);
        }}
      />
      <button
        onClick={() => inputRef.current && onSave(inputRef.current.value)}
        className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-1.5 transition-colors"
      >
        Save
      </button>
      {onClear && (
        <button onClick={onClear} className="text-xs text-indigo-500 hover:text-indigo-700">
          Clear
        </button>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label:   string;
  value:   string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-zinc-900"}`}>{value}</p>
    </div>
  );
}

function accuracyColor(pct: number): string {
  if (pct >= 70) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

function ActivityChart({ data }: { data: ActivityEntry[] }) {
  const filled = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d.count]));
    const result: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      result.push({ date: key.slice(5).replace("-", "/"), count: map.get(key) ?? 0 });
    }
    return result;
  }, [data]);

  const hasData = filled.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-zinc-400">
        No activity in the last 30 days
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={filled} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          interval={6}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={24}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
          itemStyle={{ color: "#6366f1" }}
          labelStyle={{ color: "#71717a" }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="Questions"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WeeklyProgressChart({ data }: { data: WeeklyProgress[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      week: d.week.replace(/^\d{4}-W/, "W"),
      accuracy: Math.round(d.avgAccuracy),
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={36}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
          formatter={(v) => [`${v}%`, "Avg Accuracy"]}
        />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#accuracyGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopicChart({ data }: { data: TopicAccuracy[] }) {
  const chartData = useMemo(() => {
    return [...data]
      .filter((d) => d.avgAccuracy != null)
      .sort((a, b) => (a.avgAccuracy ?? 0) - (b.avgAccuracy ?? 0))
      .slice(0, 10)
      .map((d) => ({
        topic:    capitalize(d.topic ?? ""),
        accuracy: Math.round(d.avgAccuracy ?? 0),
      }));
  }, [data]);

  const barHeight = 32;
  const chartHeight = Math.max(180, chartData.length * barHeight);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="topic"
          width={110}
          tick={{ fontSize: 10, fill: "#52525b" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
          formatter={(v) => [`${v}%`, "Accuracy"]}
          cursor={{ fill: "#f4f4f5" }}
        />
        <Bar dataKey="accuracy" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
