"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {hint ? <div className="mt-2 text-xs text-white/60">{hint}</div> : null}
    </div>
  );
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
          title="Quickfire"
          subtitle="Short reps. Immediate feedback. Built for consistency."
          right={<Badge>{engineSummary.dueCount} due</Badge>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Start</div>
              <div className="mt-2 text-sm text-white/80">
                10 MCQs → Autopsy Mode → confidence check.
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/app/session"
                  className="btn btn-primary w-full sm:w-auto"
                >
                  Start Quickfire
                </Link>
                <Link
                  href="/app/review"
                  className="btn btn-ghost w-full sm:w-auto"
                >
                  Review history
                </Link>
              </div>
              <div className="mt-3 text-xs text-white/60">
                Local attempts:{" "}
                <span className="text-white/80">{attemptCount}</span>
              </div>
            </AppCardSoft>

            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Due now</div>
              <div className="mt-2 text-sm text-white/80">
                You have{" "}
                <span className="text-white">{engineSummary.dueCount}</span>{" "}
                items due for reinforcement.
              </div>
              <div className="mt-4">
                <Link
                  href="/app/session"
                  className="btn btn-outline w-full sm:w-auto"
                >
                  Review due items
                </Link>
              </div>
              <div className="mt-3 text-xs text-white/60">
                The engine schedules what you need, when you need it.
              </div>
            </AppCardSoft>
          </div>
        </AppCard>

        <AppCard
          title="Quick Actions"
          subtitle="Jump straight to the right mode."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/app/learn"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Learn</div>
              <div className="mt-1 text-xs text-white/60">
                Browse topics and drill down
              </div>
            </Link>

            <Link
              href="/app/revise"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Revise</div>
              <div className="mt-1 text-xs text-white/60">
                Quickfire and targeted review
              </div>
            </Link>

            <Link
              href="/app/progress"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Progress</div>
              <div className="mt-1 text-xs text-white/60">
                Trends, weak areas, momentum
              </div>
            </Link>

            <Link
              href="/app/account"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Account</div>
              <div className="mt-1 text-xs text-white/60">
                Billing and settings
              </div>
            </Link>
          </div>
        </AppCard>

        <AppCard
          title="Insights"
          subtitle="Signals that help you decide what to do next."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AppCardSoft className="px-4 py-4">
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
            </AppCardSoft>

            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Momentum</div>
              <div className="mt-2 text-sm text-white/80">
                Current streak:{" "}
                <span className="text-white">{metrics.streakDays}</span> days.
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/app/progress"
                  className="btn btn-outline w-full sm:w-auto"
                >
                  View progress
                </Link>
                <Link
                  href="/app/revise"
                  className="btn btn-ghost w-full sm:w-auto"
                >
                  Go to Revise
                </Link>
              </div>
              <div className="mt-3 text-xs text-white/60">
                Momentum beats intensity. Keep sessions short.
              </div>
            </AppCardSoft>
          </div>
        </AppCard>
      </div>

      {/* RIGHT */}
      <div className="grid gap-6">
        <AppCard
          title="LRARE score"
          subtitle="Derived from your learning stability and scheduling."
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs text-white/60">Score</div>

            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="text-4xl font-semibold tracking-tight text-white">
                {engineScore}
              </div>
              <div className="text-xs text-white/60">
                Stability, difficulty and
                <br />
                next-due pressure.
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70"
                style={{ width: `${engineScore}%` }}
              />
            </div>

            <div className="mt-3 text-xs text-white/60">
              A higher score means your reviewed material is more stable.
            </div>
          </div>
        </AppCard>

        <AppCard title="At a glance" subtitle="Fast signals for today.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Due now"
              value={engineSummary.dueCount}
              hint="items"
            />
            <StatCard label="Streak" value={metrics.streakDays} hint="days" />
            <StatCard
              label="Accuracy (7d)"
              value={formatPercent01(metrics.accuracy7d)}
            />
            <StatCard
              label="Confidence (7d)"
              value={
                <>
                  {metrics.confidenceNet7d > 0 ? "+" : ""}
                  {metrics.confidenceNet7d}
                </>
              }
              hint="net change"
            />
          </div>
        </AppCard>
      </div>
    </div>
  );
}