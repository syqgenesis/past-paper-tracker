import Link from "next/link";
import { FolderSearch, ScanLine, NotebookPen, ShieldCheck, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: FolderSearch,
    title: "Point it at your papers",
    body: (
      <>
        Copy <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px]">.env.example</code> to{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px]">.env.local</code> and set{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px]">PAPERS_ROOT</code> to the folder
        holding your question papers and mark schemes.
      </>
    ),
  },
  {
    icon: ScanLine,
    title: "Scan your library",
    body: (
      <>
        Head to <span className="font-medium text-zinc-700">Settings</span> and hit{" "}
        <span className="font-medium text-zinc-700">Scan Papers</span>. Every PDF is detected and matched by year
        and paper number. Safe to re-run any time.
      </>
    ),
  },
  {
    icon: NotebookPen,
    title: "Log attempts, track gaps",
    body: (
      <>
        Open a paper, add its questions, and record each attempt — score, confidence, and notes. The dashboard then
        surfaces weak topics, cold areas, and a review queue.
      </>
    ),
  },
];

export default function FirstRunWelcome() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-10">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          Welcome
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          Let&rsquo;s set up your past paper tracker
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          No papers in your library yet. Three quick steps and you&rsquo;ll be tracking your revision question by
          question.
        </p>

        <ol className="mt-8 space-y-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={i} className="flex gap-4">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-zinc-50 ring-1 ring-zinc-200">
                  <Icon className="h-5 w-5 text-indigo-600" strokeWidth={1.75} />
                </div>
                <div className="pt-0.5">
                  <h3 className="text-sm font-medium text-zinc-900">
                    <span className="mr-2 text-zinc-300">{i + 1}</span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Go to Settings &amp; scan papers
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            href="/papers"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            Browse papers
          </Link>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
        Everything stays on your machine — your data is never uploaded.
      </p>
    </div>
  );
}
