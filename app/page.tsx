import {
  getDashboardStats,
  getAccuracyByTopic,
  getColdTopics,
  getActivityOverTime,
  getWeakTopics,
  getReviewQueue,
  getQuestionCounts,
  getWeeklyProgress,
  getStudyStreak,
} from "@/lib/analytics";
import { getSessionStats } from "@/lib/session-analytics";
import DashboardClient from "./dashboard-client";

export default function DashboardPage() {
  const stats           = getDashboardStats();
  const accuracyByTopic = getAccuracyByTopic();
  const coldTopics      = getColdTopics(7);
  const activity        = getActivityOverTime(30);
  const weakTopics      = getWeakTopics(60);
  const reviewPreview   = getReviewQueue().slice(0, 5);
  const questionCounts  = getQuestionCounts();
  const weeklyProgress  = getWeeklyProgress(8);
  const streak          = getStudyStreak();
  const sessionStats    = getSessionStats();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Your revision at a glance</p>
      </div>

      <DashboardClient
        stats={stats}
        accuracyByTopic={accuracyByTopic}
        coldTopics={coldTopics}
        activity={activity}
        weakTopics={weakTopics}
        reviewPreview={reviewPreview}
        questionCounts={questionCounts}
        weeklyProgress={weeklyProgress}
        streak={streak}
        sessionStats={sessionStats}
      />
    </div>
  );
}
