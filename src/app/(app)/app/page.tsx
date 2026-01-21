import Link from "next/link";
import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import {
  demoMetrics,
  demoTodaySession,
  demoUser,
  demoWeakAreas,
} from "@/lib/demoData";
import {
  computeDashboardScore,
  formatPercent,
  insightFromWeakAreas,
} from "@/lib/selectors";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
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
  const score = computeDashboardScore(demoMetrics);
  const insights = insightFromWeakAreas(demoWeakAreas);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* LEFT COLUMN */}
      <div className="grid gap-6">
        <AppCard
          title={`Welcome back, ${demoUser.name}`}
          subtitle={`${demoUser.exam} • ${demoUser.daysToExam} days to exam`}
          right={<Badge>Today</Badge>}
        >
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">{demoTodaySession.title}</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-white">
                {demoTodaySession.focus}
              </div>
              <div className="mt-2 text-sm text-white/75">
                {demoTodaySession.questions} MCQs • ~{demoTodaySession.minutes} minutes
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/app/session" className="btn btn-primary w-full sm:w-auto">
                  Start session
                </Link>
                <Link href="/app/review" className="btn btn-ghost w-full sm:w-auto">
                  Review queue
                </Link>
              </div>

              <div className="mt-3 text-xs text-white/60">
                Built for consistency: short sessions, structured review.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs text-white/60">This week</div>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Reviewed</div>
                  <div className="text-sm font-semibold text-white">
                    {demoMetrics.reviewedThisWeek}
                  </div>
                </div>

                <div className="h-px w-full bg-white/10" />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Accuracy</div>
                  <div className="text-sm font-semibold text-white">
                    {formatPercent(demoMetrics.accuracy7d)}
                  </div>
                </div>

                <div className="h-px w-full bg-white/10" />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/80">Confidence</div>
                  <div className="text-sm font-semibold text-white">
                    {demoMetrics.confidenceNet7d > 0 ? "+" : ""}
                    {demoMetrics.confidenceNet7d}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard title="Insights" subtitle="Where you’re winning and what to tighten next.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Needs work</div>
              <ul className="mt-3 grid gap-2">
                {insights.needsWork.map((t) => (
                  <li
                    key={t.topic}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span className="text-sm text-white/85">{t.topic}</span>
                    <span className="text-xs text-white/60">focus</span>
                  </li>
                ))}
              </ul>
            </AppCardSoft>

            <AppCardSoft className="px-4 py-4">
              <div className="text-xs text-white/60">Improving</div>
              <ul className="mt-3 grid gap-2">
                {insights.improving.map((t) => (
                  <li
                    key={t.topic}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span className="text-sm text-white/85">{t.topic}</span>
                    <span className="text-xs text-white/60">up</span>
                  </li>
                ))}
              </ul>
            </AppCardSoft>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/app/progress" className="btn btn-outline w-full sm:w-auto">
              View progress
            </Link>
            <Link href="/app/library" className="btn btn-ghost w-full sm:w-auto">
              Open library
            </Link>
          </div>
        </AppCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="grid gap-6">
        <AppCard
          title="LRARE score"
          subtitle="Web placeholder until we wire the engine values."
          right={<span className="chip">Live soon</span>}
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs text-white/60">Score</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="text-4xl font-semibold tracking-tight text-white">
                {score}
              </div>
              <div className="text-xs text-white/60">
                Based on streak, accuracy,
                <br />
                review volume, confidence.
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70"
                style={{ width: `${score}%` }}
              />
            </div>

            <div className="mt-3 text-xs text-white/60">
              Next step: pull the real score + insights from your LRAREKit engine.
            </div>
          </div>
        </AppCard>

        <AppCard title="At a glance" subtitle="Fast signals for today.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Stat label="Streak" value={`${demoMetrics.streakDays}`} hint="days" />
            <Stat label="Accuracy (7d)" value={formatPercent(demoMetrics.accuracy7d)} />
            <Stat
              label="Confidence (7d)"
              value={`${demoMetrics.confidenceNet7d > 0 ? "+" : ""}${demoMetrics.confidenceNet7d}`}
              hint="net change"
            />
          </div>
        </AppCard>

        <AppCard title="Next actions" subtitle="Keep the loop tight.">
          <div className="grid gap-2">
            <Link
              href="/app/session"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Start session</div>
              <div className="mt-1 text-xs text-white/60">
                10 MCQs → Autopsy Mode → confidence check
              </div>
            </Link>

            <Link
              href="/app/review"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7"
            >
              <div className="text-sm font-semibold text-white">Review queue</div>
              <div className="mt-1 text-xs text-white/60">
                Clean up weak areas while it’s fresh
              </div>
            </Link>
          </div>
        </AppCard>
      </div>
    </div>
  );
}