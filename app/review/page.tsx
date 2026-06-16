import { getReviewQueue } from "@/lib/analytics";
import { ReviewClient } from "./review-client";

export default function ReviewPage() {
  const items = getReviewQueue();

  // Extract distinct filter options from data
  const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))] as string[];
  const years = [...new Set(items.map((i) => i.year))].sort((a, b) => b - a);
  const paperNumbers = [...new Set(items.map((i) => i.paperNumber))].sort();
  const mistakeTypes = [...new Set(items.map((i) => i.mistakeType).filter(Boolean))] as string[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Review Queue</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Questions flagged for re-study — oldest first for spaced repetition.
        </p>
      </div>

      <ReviewClient
        items={items}
        filterOptions={{ topics, years, paperNumbers, mistakeTypes }}
      />
    </div>
  );
}
