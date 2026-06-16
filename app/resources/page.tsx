import { scanResources } from "@/lib/resources";
import { ResourcesClient } from "./resources-client";

export default function ResourcesPage() {
  const groups = scanResources();
  const totalCount = groups.reduce((sum, g) => sum + g.resources.length, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Resources</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Generated study materials and course handouts, grouped by module — {totalCount} file{totalCount === 1 ? "" : "s"}.
        </p>
      </div>
      <ResourcesClient groups={groups} />
    </div>
  );
}
