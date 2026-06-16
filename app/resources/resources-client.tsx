"use client";

import { useState } from "react";
import type { Resource, ResourcesByTopic } from "@/lib/resources";

interface Props {
  groups: ResourcesByTopic[];
}

export function ResourcesClient({ groups }: Props) {
  // First topic expanded by default; others collapsed. Tracks topic codes in a
  // Set so toggling is O(1) and we don't have to wire one boolean per topic.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return groups.length > 0 ? new Set([groups[0].topic]) : new Set();
  });

  function toggle(topic: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(groups.map((g) => g.topic)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        No resources found. Add files with a module-code prefix (e.g. <code>A1_*.docx</code>) to your /Chem folder or the Handouts/ subfolder.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-zinc-500">
        <button type="button" onClick={expandAll} className="underline hover:text-zinc-900">
          Expand all
        </button>
        <span className="text-zinc-300">·</span>
        <button type="button" onClick={collapseAll} className="underline hover:text-zinc-900">
          Collapse all
        </button>
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const isOpen = expanded.has(g.topic);
          return (
            <section key={g.topic} className="overflow-hidden rounded-xl border border-zinc-200">
              <button
                type="button"
                onClick={() => toggle(g.topic)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between bg-zinc-50 px-4 py-3 text-left hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-semibold text-zinc-900">{g.topic}</span>
                  <span className="text-xs text-zinc-500">
                    {g.resources.length} file{g.resources.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-zinc-400 text-sm" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <ul className="divide-y divide-zinc-200">
                  {g.resources.map((r) => (
                    <ResourceRow key={r.fullPath} resource={r} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ResourceRow({ resource: r }: { resource: Resource }) {
  const href = `/api/file?path=${encodeURIComponent(r.fullPath)}`;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors">
      <ExtensionIcon ext={r.extension} />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm text-zinc-900">{r.filename}</div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <SourceBadge source={r.source} />
          <span>·</span>
          <span suppressHydrationWarning>{r.modifiedAt.slice(0, 10)}</span>
          <span>·</span>
          <span>{formatSize(r.sizeBytes)}</span>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-100 transition-colors"
      >
        Open ↗
      </a>
    </li>
  );
}

function SourceBadge({ source }: { source: Resource["source"] }) {
  const label = source === "handouts" ? "Handouts" : "Generated";
  const tone = source === "handouts"
    ? "bg-indigo-50 text-indigo-700"
    : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function ExtensionIcon({ ext }: { ext: string }) {
  const label = ext.slice(1).toUpperCase(); // ".pdf" → "PDF"
  const tone =
    ext === ".pdf"  ? "bg-rose-50 text-rose-700" :
    ext === ".docx" ? "bg-blue-50 text-blue-700" :
    ext === ".html" ? "bg-amber-50 text-amber-800" :
    ext === ".md"   ? "bg-zinc-100 text-zinc-700" :
    ext === ".tsv"  ? "bg-violet-50 text-violet-700" :
                      "bg-zinc-100 text-zinc-700";
  return (
    <span className={`shrink-0 inline-flex h-7 w-10 items-center justify-center rounded-md text-[10px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
