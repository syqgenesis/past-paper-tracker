import { NextResponse } from "next/server";
import {
  getDashboardStats,
  getAccuracyByTopic,
  getColdTopics,
  getActivityOverTime,
  getWeakTopics,
  getWeeklyProgress,
  getStudyStreak,
} from "@/lib/analytics";

export async function GET() {
  const [stats, accuracyByTopic, coldTopics, activity, weakTopics, weeklyProgress, streak] = [
    getDashboardStats(),
    getAccuracyByTopic(),
    getColdTopics(7),
    getActivityOverTime(30),
    getWeakTopics(60),
    getWeeklyProgress(8),
    getStudyStreak(),
  ];

  return NextResponse.json({ stats, accuracyByTopic, coldTopics, activity, weakTopics, weeklyProgress, streak });
}
