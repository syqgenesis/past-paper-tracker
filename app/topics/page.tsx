import { getTopicIndex } from "@/lib/analytics";
import { TopicsClient } from "./topics-client";

export default function TopicsPage() {
  const rows = getTopicIndex();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Topics</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Every topic with at least one question. Click a row to drill into your attempts and notes.
        </p>
      </div>

      <TopicsClient rows={rows} />
    </div>
  );
}
