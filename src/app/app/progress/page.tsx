"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, type DocumentData, type Timestamp } from "firebase/firestore";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Flame,
  Target,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";

import { auth, db } from "@/lib/firebase/client";
import { AppCard } from "@/components/ui/AppCard";

type StatsDoc = {
  totalAnswered?: number;
  totalCorrect?: number;
  streak?: number;
  longestStreak?: number;
  updatedAt?: Timestamp;
};

type DailyMapDoc = Record<string, number>; // { "YYYY-MM-DD": count }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toDateKey(d: Date) {
  // local date key: YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDaysKeys(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}

function fmtPct(n01: number) {
  return `${Math.round(clamp(n01, 0, 1) * 100)}%`;
}

function computeLrareScore(args: { totalAnswered: number; totalCorrect: number; streak: number }) {
  // Mirror iOS:
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

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <Icon className="h-4 w-4 text-white/50" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {sub ? <div className="mt-2 text-xs text-white/55">{sub}</div> : null}
    </div>
  );
}

function MiniLine({
  values,
  min = 0,
  max = 100,
}: {
  values: number[];
  min?: number;
  max?: number;
}) {
  const w = 240;
  const h = 64;
  const pad = 6;

  const pts = useMemo(() => {
    if (!values.length) return "";
    const xs = values.map((_, i) => (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w));
    const ys = values.map((v) => {
      const t = (clamp(v, min, max) - min) / (max - min || 1);
      return h - pad - t * (h - pad * 2);
    });
    return xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  }, [values, min, max]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">LRARE Over Time</div>
        <div className="text-xs text-white/60">Last 7 days</div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/3">
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="LRARE over time">
          {/* baseline */}
          <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
          {/* polyline */}
          {pts ? (
            <polyline
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/60">
        <span>{values.length ? `${values[0]} → ${values[values.length - 1]}` : "No data yet"}</span>
        <span>Score (0–100)</span>
      </div>
    </div>
  );
}

function Heatmap14({ countsByDay }: { countsByDay: Record<string, number> }) {
  const keys = useMemo(() => lastNDaysKeys(14), []);
  const max = useMemo(() => {
    let m = 0;
    for (const k of keys) m = Math.max(m, countsByDay[k] ?? 0);
    return m;
  }, [keys, countsByDay]);

  function boxCls(v: number) {
    if (v <= 0) return "bg-white/5 border-white/10";
    // scale into 1..4
    const t = max > 0 ? v / max : 0;
    if (t < 0.34) return "bg-white/10 border-white/12";
    if (t < 0.67) return "bg-white/15 border-white/15";
    return "bg-white/20 border-white/18";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CalendarDays className="h-4 w-4 text-white/60" />
          Study timeline
        </div>
        <div className="text-xs text-white/60">Last 14 days</div>
      </div>

      <div className="mt-4 grid grid-cols-14 gap-2">
        {keys.map((k) => {
          const v = countsByDay[k] ?? 0;
          return (
            <div key={k} className="grid gap-1">
              <div
                title={`${k}: ${v}`}
                className={[
                  "h-7 w-full rounded-lg border",
                  boxCls(v),
                  "transition",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/55">
        <span>Less</span>
        <span>More</span>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [stats, setStats] = useState<StatsDoc | null>(null);
  const [activityDaily, setActivityDaily] = useState<DailyMapDoc>({});
  const [lrareDaily, setLrareDaily] = useState<DailyMapDoc>({});

  const [error, setError] = useState<string | null>(null);

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // listeners
  useEffect(() => {
    if (!user) return;

    setError(null);

    const statsRef = doc(db, "users", user.uid, "stats", "current");
    const unsubStats = onSnapshot(
      statsRef,
      (snap) => {
        setStats((snap.data() as DocumentData | undefined) as StatsDoc | null);
      },
      (e) => {
        console.error(e);
        setError("Couldn’t load your progress (stats).");
      },
    );

    const activityRef = doc(db, "users", user.uid, "metrics", "activityDaily");
    const unsubAct = onSnapshot(
      activityRef,
      (snap) => {
        setActivityDaily(((snap.data() as DocumentData) ?? {}) as DailyMapDoc);
      },
      () => {
        setActivityDaily({});
      },
    );

    const lrareRef = doc(db, "users", user.uid, "metrics", "lrareDaily");
    const unsubLrare = onSnapshot(
      lrareRef,
      (snap) => {
        setLrareDaily(((snap.data() as DocumentData) ?? {}) as DailyMapDoc);
      },
      () => {
        setLrareDaily({});
      },
    );

    return () => {
      unsubStats();
      unsubAct();
      unsubLrare();
    };
  }, [user]);

  const totals = useMemo(() => {
    const totalAnswered = Number(stats?.totalAnswered ?? 0) || 0;
    const totalCorrect = Number(stats?.totalCorrect ?? 0) || 0;
    const streak = Number(stats?.streak ?? 0) || 0;
    const longestStreak = Number(stats?.longestStreak ?? 0) || 0;

    const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
    const lrare = computeLrareScore({ totalAnswered, totalCorrect, streak });

    const consistency14 = clamp(streak / 14, 0, 1);

    return { totalAnswered, totalCorrect, streak, longestStreak, accuracy, lrare, consistency14 };
  }, [stats]);

  const lrare7 = useMemo(() => {
    const keys = lastNDaysKeys(7);
    const values = keys.map((k) => Number(lrareDaily?.[k] ?? 0) || 0);
    const start = values.length ? values[0] : 0;
    const end = values.length ? values[values.length - 1] : 0;
    const delta = end - start;
    return { keys, values, delta };
  }, [lrareDaily]);

  if (!authReady) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Loading…</div>
        <div className="mt-2 text-sm text-white/70">Checking sign-in.</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Sign in required</div>
        <div className="mt-2 text-sm text-white/70">Sign in to view your progress.</div>
        <div className="mt-5">
          <Link href="/auth" className="btn btn-primary w-full sm:w-auto">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <AppCard
        title="Progress"
        subtitle="Your stats, streak, and LRARE Score."
        right={
          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
        }
      >
        {error ? (
          <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            icon={CheckCircle2}
            label="Answered"
            value={totals.totalAnswered}
            sub="Total questions attempted"
          />
          <StatTile
            icon={ThumbsUp}
            label="Correct"
            value={totals.totalCorrect}
            sub="Total correct answers"
          />
          <StatTile
            icon={Target}
            label="Accuracy"
            value={fmtPct(totals.accuracy)}
            sub="Across your whole account"
          />
          <StatTile
            icon={Flame}
            label="Streak"
            value={`${totals.streak}d`}
            sub="Current streak"
          />
          <StatTile
            icon={TrendingUp}
            label="Longest"
            value={`${totals.longestStreak}d`}
            sub="Best streak so far"
          />
          <StatTile
            icon={BarChart3}
            label="LRARE Score"
            value={totals.lrare}
            sub="0–100"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-sm font-semibold text-white">Mastery & Consistency</div>
            <div className="mt-2 text-xs text-white/60">
              Consistency uses your streak (0–14 days).
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-xs text-white/60">LRARE</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {totals.lrare}
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{ width: `${clamp(totals.lrare, 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-xs text-white/60">Consistency</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {Math.round(totals.consistency14 * 100)}%
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{ width: `${Math.round(totals.consistency14 * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-white/55">Based on a 14-day window.</div>
              </div>
            </div>
          </div>

          <MiniLine values={lrare7.values} />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Heatmap14 countsByDay={activityDaily} />

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-sm font-semibold text-white">This week</div>
            <div className="mt-2 text-sm text-white/80">
              {lrare7.delta === 0 ? (
                <>Your LRARE is steady over the last 7 days.</>
              ) : lrare7.delta > 0 ? (
                <>
                  Your LRARE is up <span className="text-white font-semibold">{lrare7.delta}</span>{" "}
                  points over the last 7 days.
                </>
              ) : (
                <>
                  Your LRARE is down{" "}
                  <span className="text-white font-semibold">{Math.abs(lrare7.delta)}</span>{" "}
                  points over the last 7 days.
                </>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/app/session" className="btn btn-primary w-full sm:w-auto">
                Start Quickfire
              </Link>
              <Link href="/app/learn" className="btn btn-outline w-full sm:w-auto">
                Go to Learn
              </Link>
            </div>

          </div>
        </div>
      </AppCard>
    </div>
  );
}