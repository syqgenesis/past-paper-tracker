"use client";

import { useState, useEffect } from "react";

interface ScanResult {
  scanned:        number;
  matched:        number;
  unmatched:      number;
  unmatchedFiles: string[];
  upserted:       number;
  error?:         string;
}

export default function SettingsPage() {
  const [scanning, setScanning]     = useState(false);
  const [result,   setResult]       = useState<ScanResult | null>(null);
  const [examDate, setExamDate]     = useState("");

  useEffect(() => {
    setExamDate(localStorage.getItem("examDate") ?? "");
  }, []);

  function handleExamDateChange(value: string) {
    setExamDate(value);
    if (value) localStorage.setItem("examDate", value);
    else localStorage.removeItem("examDate");
  }

  const daysRemaining = examDate
    ? Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  async function runScan() {
    setScanning(true);
    setResult(null);
    try {
      const res  = await fetch("/api/scan", { method: "POST" });
      const data = await res.json() as ScanResult;
      setResult(data);
    } catch {
      setResult({ scanned: 0, matched: 0, unmatched: 0, unmatchedFiles: [], upserted: 0, error: "Network error — check console." });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Configure your past paper library.</p>

      {/* File Scanner */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 mb-6">
        <h2 className="font-medium text-zinc-900 mb-1">Paper Library</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Scan your local folder to detect available papers. Safe to run multiple times.
        </p>

        <button
          onClick={runScan}
          disabled={scanning}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {scanning ? "Scanning…" : "Scan Papers"}
        </button>

        {result && (
          <div className="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-sm">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <Stat label="Scanned" value={result.scanned} />
                  <Stat label="Matched" value={result.matched} />
                  <Stat label="Unmatched" value={result.unmatched} />
                </div>

                {result.unmatchedFiles.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-amber-600 font-medium text-xs">
                      {result.unmatched} file(s) could not be matched to a paper number
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {result.unmatchedFiles.map((f) => (
                        <li key={f} className="text-zinc-500 font-mono text-xs">{f}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <p className="text-zinc-500 mt-2 text-xs">
                  {result.upserted} paper record(s) written to database.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Exam Date */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 mb-6">
        <h2 className="font-medium text-zinc-900 mb-1">Exam Countdown</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Set your exam date to see a countdown and daily question target on the dashboard.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={examDate}
            onChange={(e) => handleExamDateChange(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {examDate && (
            <button
              onClick={() => handleExamDateChange("")}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {daysRemaining != null && daysRemaining > 0 && (
          <p className="text-xs text-zinc-400 mt-2">{daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining</p>
        )}
        {daysRemaining != null && daysRemaining <= 0 && (
          <p className="text-xs text-red-500 mt-2">That date has passed.</p>
        )}
      </section>

      {/* Config info */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-900 mb-3">Configuration</h2>
        <p className="text-sm text-zinc-500">
          Papers root is set via <code className="bg-zinc-100 px-1 rounded text-xs">PAPERS_ROOT</code> in{" "}
          <code className="bg-zinc-100 px-1 rounded text-xs">.env.local</code>.
          Edit that file to change the folder path.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
