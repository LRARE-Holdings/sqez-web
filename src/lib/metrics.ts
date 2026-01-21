import type { Attempt } from "./storage";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type DashboardMetrics = {
  streakDays: number;
  accuracy7d: number; // 0..1
  confidenceNet7d: number; // -N..+N
  reviewedThisWeek: number;
};

export function computeMetrics(attempts: Attempt[]): DashboardMetrics {
  const now = new Date();

  // reviewed this week (rolling 7d)
  const last7 = attempts.filter((a) => {
    const d = new Date(a.createdAt);
    return daysBetween(now, d) >= 0 && daysBetween(now, d) < 7;
  });

  const reviewedThisWeek = last7.length;

  // accuracy 7d
  const correct7 = last7.filter((a) => a.signal.correct).length;
  const accuracy7d = last7.length ? correct7 / last7.length : 0;

  // confidence net 7d (simple: correct adds, incorrect subtracts, weighted by confidence)
  const confidenceNet7d = last7.reduce((acc, a) => {
    const c = Math.max(1, Math.min(5, a.signal.confidence));
    return acc + (a.signal.correct ? c : -c);
  }, 0);

  // streak: count consecutive days with >= 1 attempt
  const daysWithAttempts = new Set(
    attempts.map((a) => startOfDay(new Date(a.createdAt)).toISOString()),
  );

  let streakDays = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = startOfDay(new Date(now));
    day.setDate(day.getDate() - i);
    if (daysWithAttempts.has(day.toISOString())) {
      streakDays += 1;
    } else {
      break;
    }
  }

  return { streakDays, accuracy7d, confidenceNet7d, reviewedThisWeek };
}

/**
 * Web score placeholder (0..100) until we port your full LRAREKit engine.
 */
export function computeWebScore(m: DashboardMetrics) {
  const streakScore = Math.min(1, m.streakDays / 14);
  const accuracyScore = Math.max(0, Math.min(1, m.accuracy7d));
  const confScore = Math.max(0, Math.min(1, (m.confidenceNet7d + 20) / 40));
  const volumeScore = Math.min(1, m.reviewedThisWeek / 60);

  const blended =
    0.32 * accuracyScore +
    0.24 * streakScore +
    0.22 * confScore +
    0.22 * volumeScore;

  return Math.round(blended * 100);
}