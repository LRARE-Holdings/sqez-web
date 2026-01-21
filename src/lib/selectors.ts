import type { DemoMetrics, DemoWeakArea } from "./demoData";

export function formatPercent(value01: number) {
  const pct = Math.round(value01 * 100);
  return `${pct}%`;
}

/**
 * A web-first “dashboard readiness” metric to stand in for LRARE score
 * until we wire the real engine values.
 *
 * Returns 0..100.
 */
export function computeDashboardScore(m: DemoMetrics) {
  const streakScore = Math.min(1, m.streakDays / 14);
  const accuracyScore = Math.max(0, Math.min(1, m.accuracy7d));
  const confidenceScore = Math.max(0, Math.min(1, (m.confidenceNet7d + 20) / 40));
  const reviewScore = Math.min(1, m.reviewedThisWeek / 60);

  const blended =
    0.32 * accuracyScore +
    0.24 * streakScore +
    0.22 * confidenceScore +
    0.22 * reviewScore;

  return Math.round(blended * 100);
}

export function insightFromWeakAreas(areas: DemoWeakArea[]) {
  const needsWork = areas.filter((a) => a.trend === "needs-work").slice(0, 2);
  const improving = areas.filter((a) => a.trend === "improving").slice(0, 2);

  return {
    needsWork,
    improving,
  };
}