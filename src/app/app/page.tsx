"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { getAttempts } from "@/lib/storage";
import { computeMetrics } from "@/lib/metrics";
import { getItemMetas, summarizeEngine } from "@/lib/engineStore";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
}

function formatPercent01(v: number) {
  return `${Math.round(v * 100)}%`;
}

export default function DashboardPage() {
  const [attemptCount, setAttemptCount] = useState(0);
  const [metrics, setMetrics] = useState(() => computeMetrics([]));
  const [engineSummary, setEngineSummary] = useState(() => ({
    avgStability: 0,
    avgDifficulty: 0,
    dueCount: 0,
  }));

  useEffect(() => {
    const attempts = getAttempts();
    setAttemptCount(attempts.length);
    setMetrics(computeMetrics(attempts));

    const items = getItemMetas();
    setEngineSummary(summarizeEngine(items));
  }, []);

  const engineScore = Math.min(
    100,
    Math.round(engineSummary.avgStability * 10),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* LEFT */}
      <div className="grid gap-6">
        <AppCard
          title="Dashboard"
          subtitle="A desktop-native view of today, insights, and momentum."
          right={<Badge>Today</Badge>}
        >
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">Today’s session</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-white">
                10 MCQs → Autopsy Mode → confidence check
              </div>
              <div className="mt-2 text-sm text-white/75">
                Designed for consistency. Built for short sessions.
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/app/session" className="btn btn-primary w-full sm:w-auto">
                  Start session
                </Link>
                <Link href="/app/review" className="btn btn-ghost w-full sm:w-auto">
                  Review history
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/60">
                Attempts stored locally for now: <span className="text-white/80">{attemptCount}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">This week</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Reviewed</div>
                  <div className="text-sm font-semibold text-white">
                    {metrics.reviewedThisWeek}
                  </div>
                </div>
                <div className="h-px w-full bg-white/10" />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Accuracy</div>
                  <div className="text-sm font-semibold text-white">
                    {formatPercent01(metrics.accuracy7d)}
                  </div>
                </div>
                <div className="h-px w-full bg-white/10" />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Confidence</div>
                  <div className="text-sm font-semibold text-white">
                    {metrics.confidenceNet7d > 0 ? "+" : ""}
                    {metrics.confidenceNet7d}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard title="Insights" subtitle="Live insights will come from your engine next.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">What to do next</div>
              <div className="mt-2 text-sm text-white/80">
                Run a session today. Your dashboard updates automatically.
              </div>
              <div className="mt-4">
                <Link href="/app/session" className="btn btn-outline w-full sm:w-auto">
                  Start now
                </Link>
              </div>
            </AppCardSoft>

            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Momentum</div>
              <div className="mt-2 text-sm text-white/80">
                Your streak is <span className="text-white">{metrics.streakDays}</span> days.
              </div>
              <div className="mt-4">
                <Link href="/app/progress" className="btn btn-ghost w-full sm:w-auto">
                  View progress
                </Link>
              </div>
            </AppCardSoft>
          </div>
        </AppCard>
      </div>

      {/* RIGHT */}
      <div className="grid gap-6">
        <AppCard
          title="Score"
          subtitle="Derived from your learning stability and review history."
          right={<span className="chip">Engine wiring next</span>}
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs text-white/60">Score</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="text-4xl font-semibold tracking-tight text-white">
                {engineScore}
              </div>
              <div className="text-xs text-white/60">
                Based on your LRARE learning state
                <br />
                (stability & scheduling).
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70"
                style={{ width: `${engineScore}%` }}
              />
            </div>
          </div>
        </AppCard>

        <AppCard title="At a glance" subtitle="Fast signals for today.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">Due now</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {engineSummary.dueCount}
              </div>
              <div className="mt-2 text-xs text-white/60">items</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">Streak</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {metrics.streakDays}
              </div>
              <div className="mt-2 text-xs text-white/60">days</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">Accuracy (7d)</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {formatPercent01(metrics.accuracy7d)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">Confidence (7d)</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {metrics.confidenceNet7d > 0 ? "+" : ""}
                {metrics.confidenceNet7d}
              </div>
              <div className="mt-2 text-xs text-white/60">net change</div>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}