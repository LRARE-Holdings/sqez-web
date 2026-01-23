"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  Clock,
  Flame,
  Target,
  BookOpen,
  Layers,
  TrendingUp,
} from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { getAttempts } from "@/lib/storage";
import { computeMetrics } from "@/lib/metrics";
import { getItemMetas, summarizeEngine } from "@/lib/engineStore";

function formatPercent01(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Icon className="h-4 w-4 text-white/50" />
      <div className="min-w-0">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
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

  const lrareScore = useMemo(() => {
    return Math.min(100, Math.round(engineSummary.avgStability * 10));
  }, [engineSummary.avgStability]);

  return (
    <div className="grid gap-6">
      {/* TOP ROW */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-8">
          <AppCard
            title="Today"
            subtitle={
              engineSummary.dueCount > 0
                ? `${engineSummary.dueCount} items due for reinforcement`
                : "Nothing urgent due — keep momentum"
            }
          >
            {/* Primary action */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/app/session"
                className="group flex flex-col justify-between rounded-2xl border border-white/15 bg-white/10 px-5 py-5 transition hover:bg-white/12 !no-underline"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Zap className="h-4 w-4" />
                    Quickfire
                  </div>
                  <div className="mt-2 text-sm text-white/70">
                    10 MCQs with instant feedback and confidence check.
                  </div>
                </div>
                <div className="mt-4 text-xs text-white/60">
                  Recommended default
                </div>
              </Link>

              <Link
                href="/app/revise"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 hover:bg-white/7 !no-underline"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Layers className="h-4 w-4" />
                  Revise
                </div>
                <div className="mt-2 text-sm text-white/70">
                  Reinforce weak or due material.
                </div>
              </Link>

              <Link
                href="/app/learn"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 hover:bg-white/7 !no-underline"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BookOpen className="h-4 w-4" />
                  Learn
                </div>
                <div className="mt-2 text-sm text-white/70">
                  Browse topics and subtopics.
                </div>
              </Link>
            </div>

            {/* Secondary stats */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={Clock}
                label="Due now"
                value={engineSummary.dueCount}
              />
              <Stat
                icon={Flame}
                label="Streak"
                value={`${metrics.streakDays} days`}
              />
              <Stat
                icon={Target}
                label="Accuracy (7d)"
                value={formatPercent01(metrics.accuracy7d)}
              />
              <Stat
                icon={TrendingUp}
                label="Reviewed (7d)"
                value={metrics.reviewedThisWeek}
              />
            </div>
          </AppCard>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4">
          <AppCard title="LRARE score">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
              <div className="text-5xl font-semibold tracking-tight text-white">
                {lrareScore}
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/70"
                  style={{ width: `${lrareScore}%` }}
                />
              </div>

              <div className="mt-3 text-xs text-white/60">
                Reflects learning stability and review pressure.
              </div>
            </div>
          </AppCard>
        </div>
      </div>

      {/* LOWER ROW */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <AppCard title="Progress snapshot">
            <div className="grid gap-4">
              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">This week</div>
                <div className="mt-2 grid gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Reviewed</span>
                    <span className="text-white font-semibold">
                      {metrics.reviewedThisWeek}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Accuracy</span>
                    <span className="text-white font-semibold">
                      {formatPercent01(metrics.accuracy7d)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Confidence Δ</span>
                    <span className="text-white font-semibold">
                      {metrics.confidenceNet7d > 0 ? "+" : ""}
                      {metrics.confidenceNet7d}
                    </span>
                  </div>
                </div>
              </AppCardSoft>
            </div>
          </AppCard>
        </div>

        <div className="lg:col-span-6">
          <AppCard title="Account activity">
            <div className="text-sm text-white/70">
              Total attempts on this device:{" "}
              <span className="text-white font-semibold">
                {attemptCount}
              </span>
            </div>

            <div className="mt-4">
              <Link
                href="/app/progress"
                className="btn btn-outline !no-underline"
              >
                View detailed progress
              </Link>
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
}