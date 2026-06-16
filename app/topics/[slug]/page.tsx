import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopicDetail, resolveSlug } from "@/lib/analytics";
import { TopicDetailClient } from "./topic-detail-client";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = resolveSlug(slug);
  if (topic == null) notFound();

  const detail = getTopicDetail(topic);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/topics"
          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← All topics
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{topic}</h1>
        <SummaryBar summary={detail.summary} />
      </div>

      <TopicDetailClient questions={detail.questions} />
    </div>
  );
}

function SummaryBar({ summary }: { summary: { totalQuestions: number; attemptedQuestions: number; avgAccuracy: number | null; reviewCount: number } }) {
  const accuracyText = summary.avgAccuracy != null ? `${summary.avgAccuracy}% avg` : "—";
  const reviewText   = summary.reviewCount > 0 ? `${summary.reviewCount} in review queue` : "0 in review queue";
  return (
    <p className="mt-1 text-sm text-zinc-500">
      {summary.attemptedQuestions} of {summary.totalQuestions} attempted · {accuracyText} · {reviewText}
    </p>
  );
}
