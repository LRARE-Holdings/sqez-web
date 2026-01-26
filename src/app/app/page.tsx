"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, type DocumentData, type Timestamp } from "firebase/firestore";
import {
  Zap,
  BookOpen,
  Layers,
  BarChart3,
  Flame,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

import { auth, db } from "@/lib/firebase/client";
import { AppCard, AppCardSoft } from "@/components/ui/AppCard";

// Optional local fallback (if Firestore docs aren’t present yet)
import { getAttempts } from "@/lib/storage";
import { computeMetrics } from "@/lib/metrics";
import { getItemMetas, summarizeEngine } from "@/lib/engineStore";

type StatsDoc = {
  totalAnswered: number;
  totalCorrect: number;
  streak: number;
  longestStreak: number;
  updatedAt?: Timestamp;
};

type DailyMap = Record<string, number>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function computeLrareScore(args: {
  totalAnswered: number;
  totalCorrect: number;
  streak: number;
}) {
  // Mirror iOS (same logic as progress/page.tsx)
  // accPart    = accuracy*100*0.7
  // volumePart = (min(totalAnswered,400)/400)*100*0.2
  // streakPart = (min(streak,14)/14)*100*0.1
  const { totalAnswered, totalCorrect, streak } = args;

  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

  const accPart = accuracy * 100 * 0.7;
  const volumePart = (Math.min(totalAnswered, 400) / 400) * 100 * 0.2;
  const streakPart = (Math.min(streak, 14) / 14) * 100 * 0.1;

  return Math.round(accPart + volumePart + streakPart);
}

function fmtPct01(v: number) {
  return `${Math.round(clamp01(v) * 100)}%`;
}

function dayKey(d: Date) {
  // local date key (YYYY-MM-DD)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function lastNDaysKeys(n: number) {
  const out: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function MetricSpark({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-3 flex h-10 items-end gap-1">
        {values.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * 40));
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`${label}-${i}`}
              className="w-full rounded-md bg-white/15"
              style={{ height: `${h}px` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-white/55">
        Last 7 days • higher bar = more
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <Icon className="h-4 w-4 text-white/55" />
      <div className="min-w-0">
        <div className="text-[11px] text-white/60">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [stats, setStats] = useState<StatsDoc | null>(null);
  const [activityDaily, setActivityDaily] = useState<DailyMap>({});
  const [lrareDaily, setLrareDaily] = useState<DailyMap>({});

  const [loadingData, setLoadingData] = useState(true);

  // Local fallback (won’t block render)
  const [localFallback, setLocalFallback] = useState(() => ({
    attemptCount: 0,
    metrics: computeMetrics([]),
    engineSummary: summarizeEngine(getItemMetas()),
  }));

  // ---------- Auth ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
      if (!u) router.replace("/auth");
    });
    return () => unsub();
  }, [router]);

  // ---------- Data subscriptions ----------
  useEffect(() => {
    if (!authReady || !authUser) return;

    setLoadingData(true);

    const statsRef = doc(db, "users", authUser.uid, "stats", "current");
    const activityRef = doc(db, "users", authUser.uid, "metrics", "activityDaily");
    const lrareRef = doc(db, "users", authUser.uid, "metrics", "lrareDaily");

    const unsubStats = onSnapshot(
      statsRef,
      (snap) => {
        setStats((snap.data() as DocumentData | undefined) as StatsDoc | null);
        setLoadingData(false);
      },
      () => setLoadingData(false),
    );

    const unsubActivity = onSnapshot(
      activityRef,
      (snap) => {
        const d = (snap.data() as DocumentData | undefined) as DailyMap | undefined;
        setActivityDaily(d ?? {});
      },
      () => setActivityDaily({}),
    );

    const unsubLrare = onSnapshot(
      lrareRef,
      (snap) => {
        const d = (snap.data() as DocumentData | undefined) as DailyMap | undefined;
        setLrareDaily(d ?? {});
      },
      () => setLrareDaily({}),
    );

    return () => {
      unsubStats();
      unsubActivity();
      unsubLrare();
    };
  }, [authReady, authUser]);

  // ---------- Local fallback computation ----------
  useEffect(() => {
    try {
      const attempts = getAttempts();
      const m = computeMetrics(attempts);
      const items = getItemMetas();
      const eng = summarizeEngine(items);
      setLocalFallback({
        attemptCount: attempts.length,
        metrics: m,
        engineSummary: eng,
      });
    } catch {
      // ignore
    }
  }, []);

  // ---------- Derived metrics ----------
  const totals = useMemo(() => {
    const totalAnswered = Number(stats?.totalAnswered ?? 0) || 0;
    const totalCorrect = Number(stats?.totalCorrect ?? 0) || 0;
    const streak = Number(stats?.streak ?? 0) || 0;
    const longestStreak = Number(stats?.longestStreak ?? 0) || 0;

    const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
    const lrare = computeLrareScore({ totalAnswered, totalCorrect, streak });

    return { totalAnswered, totalCorrect, streak, longestStreak, accuracy, lrare };
  }, [stats]);

  const totalAnswered = totals.totalAnswered;
  const totalCorrect = totals.totalCorrect;
  const accuracyAll = totals.accuracy;

  const streak = totals.streak;
  const longestStreak = totals.longestStreak;

  const last7 = useMemo(() => lastNDaysKeys(7), []);
  const activity7 = useMemo(() => last7.map((k) => Number(activityDaily?.[k] ?? 0)), [activityDaily, last7]);
  const lrare7 = useMemo(() => last7.map((k) => Number(lrareDaily?.[k] ?? 0)), [lrareDaily, last7]);

  const activityDays7 = useMemo(() => activity7.filter((v) => v > 0).length, [activity7]);
  const answered7 = useMemo(() => activity7.reduce((a, b) => a + b, 0), [activity7]);

  const headline = useMemo(() => {
    if (activityDays7 >= 5) return "Strong week! Very well done.";
    if (activityDays7 >= 2) return "Good momentum, keep it up!";
    return "Let’s get you moving again!";
  }, [activityDays7]);

  const hasStats = Boolean(stats && typeof stats.totalAnswered === "number");

  return (
    <div className="grid gap-6">
      {/* HERO */}
      <AppCard
        title="Dashboard"
        subtitle={headline}
    
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Primary actions */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/app/session"
              className="group rounded-2xl border border-white/15 bg-white/10 px-5 py-5 transition hover:bg-white/12 !no-underline"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Zap className="h-4 w-4" />
                Quickfire
              </div>
              <div className="mt-2 text-sm text-white/75">
                10 random questions.
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-white/60">
                Start now <ArrowRight className="h-3.5 w-3.5" />
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
              <div className="mt-2 text-sm text-white/75">
                Build a custom topic session.
              </div>
            </Link>

            <Link
              href="/app/progress"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 hover:bg-white/7 !no-underline"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BarChart3 className="h-4 w-4" />
                Progress
              </div>
              <div className="mt-2 text-sm text-white/75">
                LRARE Score, streak and more!
              </div>
            </Link>
          </div>

          {/* LRARE card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/60">LRARE score</div>
                <div className="mt-2 text-5xl font-semibold tracking-tight text-white">
                  {totals.lrare}
                </div>
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70"
                style={{ width: `${clamp(totals.lrare, 0, 100)}%` }}
              />
            </div>

          </div>
        </div>

        {/* Snapshot row */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatPill icon={Flame} label="Streak" value={`${streak} days`} />
          <StatPill icon={TrendingUp} label="Active days (7d)" value={`${activityDays7}/7`} />
          <StatPill icon={Target} label="Accuracy (all-time)" value={fmtPct01(accuracyAll)} />
          <StatPill icon={Layers} label="Answered (7d)" value={answered7} />
        </div>

        {!hasStats ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            We haven’t synced your account stats yet. Do one Quickfire session and they’ll populate.
          </div>
        ) : null}
      </AppCard>

      {/* LOWER GRID */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <AppCard title="This week" subtitle="How you've been doing this week...">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricSpark values={activity7} label="Questions answered" />
              <MetricSpark values={lrare7.map((v) => clamp(Number(v) || 0, 0, 100))} label="LRARE over time" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Total answered</div>
                <div className="mt-2 text-lg font-semibold text-white">{totalAnswered}</div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Total correct</div>
                <div className="mt-2 text-lg font-semibold text-white">{totalCorrect}</div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Longest streak</div>
                <div className="mt-2 text-lg font-semibold text-white">{longestStreak}</div>
              </AppCardSoft>
            </div>
          </AppCard>
        </div>

        <div className="lg:col-span-5">
          <AppCard title="Quick links">
            <div className="grid gap-3">
              <Link
                href="/app/notes"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/7 !no-underline"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">View my notes</div>
                  <div className="mt-1 text-xs text-white/60">Read up on what you've put down.</div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/50" />
              </Link>

              <Link
                href="/app/learn"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/7 !no-underline"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">Browse Learn</div>
                  <div className="mt-1 text-xs text-white/60">Pick a topic and go deeper.</div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/50" />
              </Link>

              <Link
                href="/app/progress"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/7 !no-underline"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">Open Progress</div>
                  <div className="mt-1 text-xs text-white/60">Stats, timeline, LRARE.</div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/50" />
              </Link>

            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
}