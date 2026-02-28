// src/app/app/revision-bank/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { fetchQuestionsByIds } from "@/lib/questions/firestore";
import type { FireQuestion } from "@/lib/questions/types";

type BankFilter = "all" | "flagged" | "incorrect" | "lowConfidence";
type SortMode = "priority" | "recent" | "attempts";

type FireQuestionStat = {
  id: string; // documentID == questionId
  questionId?: string;

  module?: string;
  topic?: string;

  correctCount?: number;
  incorrectCount?: number;
  totalAttempts?: number;

  lastResult?: "correct" | "incorrect" | string;
  lastConfidence?: number; // 1..5 (web) or int (iOS)
  lastSeen?: { toDate?: () => Date } | null;

  flagged?: boolean;
  flaggedAt?: { toDate?: () => Date } | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toDateMaybe(v: unknown): Date | null {
  if (!v) return null;
  // Firestore Timestamp
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof v.toDate === "function"
  ) {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function dayKeyLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function scorePriority(s: {
  flagged: boolean;
  incorrectCount: number;
  totalAttempts: number;
  lastConfidence: number | null;
  lastResult: string | null;
  lastSeen: Date | null;
}) {
  // Higher score = higher priority in the bank.
  let score = 0;

  if (s.flagged) score += 1000;

  // Incorrect bias
  if (s.lastResult === "incorrect") score += 400;
  score += clamp(s.incorrectCount, 0, 50) * 10;

  // Low confidence bias
  if (s.lastConfidence !== null) {
    const inv = 6 - clamp(s.lastConfidence, 1, 5); // 5->1, 1->5
    score += inv * 25;
  }

  // Recency bias: older seen => slightly higher priority
  if (s.lastSeen) {
    const ageDays = Math.min(
      365,
      Math.max(0, Math.floor((Date.now() - s.lastSeen.getTime()) / (1000 * 60 * 60 * 24))),
    );
    score += ageDays; // small weight
  }

  // Minimum attempts bump (avoid noise)
  score += Math.min(20, s.totalAttempts) * 2;

  return score;
}

export default function RevisionBankPage() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<FireQuestion[]>([]);
  const [stats, setStats] = useState<FireQuestionStat[]>([]);

  const [filter, setFilter] = useState<BankFilter>("all");
  const [sort, setSort] = useState<SortMode>("priority");
  const [qSearch, setQSearch] = useState("");

  const lowConfidenceThreshold = 2;

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load questions + stats
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr(null);

      if (!authReady) {
        setLoading(true);
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // 1) Pull per-user questionStats
        const statsRef = collection(db, "users", user.uid, "questionStats");
        // Try to orderBy updatedAt if present; if rules/indexes complain, fall back to unordered.
        let docs;
        try {
          const qq = query(statsRef, orderBy("updatedAt", "desc"));
          docs = await getDocs(qq);
        } catch {
          docs = await getDocs(statsRef);
        }
        if (cancelled) return;

        const parsed: FireQuestionStat[] = docs.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));

        // 2) Hydrate question text only for IDs present in this user's stats.
        const wantedQuestionIds = [
          ...new Set(
            parsed.map((s) =>
              typeof s.questionId === "string" && s.questionId.trim()
                ? s.questionId
                : s.id,
            ),
          ),
        ];

        const hydrated = await fetchQuestionsByIds(wantedQuestionIds.slice(0, 1200));
        if (cancelled) return;

        setQuestions(hydrated);
        setStats(parsed);
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoading(false);
        setErr(e instanceof Error ? e.message : "Failed to load revision bank.");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  const questionById = useMemo(() => {
    const map = new Map<string, FireQuestion>();
    for (const q of questions) map.set(q.questionId, q);
    return map;
  }, [questions]);

  const merged = useMemo(() => {
    const needle = qSearch.trim().toLowerCase();

    const rows = stats
      .map((s) => {
        const qid = (s.questionId as string) || s.id;
        const q = questionById.get(qid);

        const correctCount = Math.trunc(Number(s.correctCount ?? 0) || 0);
        const incorrectCount = Math.trunc(Number(s.incorrectCount ?? 0) || 0);
        const totalAttempts = Math.trunc(Number(s.totalAttempts ?? 0) || 0);

        const lastConfidenceRaw =
          s.lastConfidence === undefined || s.lastConfidence === null
            ? null
            : Math.trunc(Number(s.lastConfidence) || 0);

        const lastConfidence =
          lastConfidenceRaw === null ? null : clamp(lastConfidenceRaw, 1, 5);

        const lastResult = (s.lastResult ?? null) as string | null;

        const flagged = Boolean(s.flagged ?? false);

        const lastSeen =
          toDateMaybe((s as Record<string, unknown>).lastSeen) ??
          toDateMaybe((s as Record<string, unknown>).updatedAt) ??
          toDateMaybe((s as Record<string, unknown>).flaggedAt);

        const moduleName = (q?.module ?? s.module ?? "").toString();
        const topic = (q?.topic ?? s.topic ?? "").toString();
        const subTopic = q?.subTopic ? String(q.subTopic) : "";

        const questionText = q?.question ?? "";

        const accuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

        const isIncorrectBucket =
          lastResult === "incorrect" || incorrectCount > 0;

        const isLowConfidenceBucket =
          lastConfidence !== null && lastConfidence <= lowConfidenceThreshold;

        const priority = scorePriority({
          flagged,
          incorrectCount,
          totalAttempts,
          lastConfidence,
          lastResult,
          lastSeen,
        });

        return {
          id: qid,
          questionText,
          moduleName,
          topic,
          subTopic,
          correctCount,
          incorrectCount,
          totalAttempts,
          accuracy,
          lastConfidence,
          lastResult,
          lastSeen,
          flagged,
          isIncorrectBucket,
          isLowConfidenceBucket,
          priority,
          hasQuestion: Boolean(q),
        };
      })
      // If a user has stats for a question that no longer exists in active bank,
      // still show it (but mark as unavailable).
      .filter((r) => {
        if (!needle) return true;
        const hay = `${r.questionText} ${r.topic} ${r.subTopic} ${r.moduleName}`
          .toLowerCase();
        return hay.includes(needle);
      })
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "flagged") return r.flagged;
        if (filter === "incorrect") return r.isIncorrectBucket;
        if (filter === "lowConfidence") return r.isLowConfidenceBucket;
        return true;
      });

    rows.sort((a, b) => {
      if (sort === "recent") {
        const ta = a.lastSeen?.getTime() ?? 0;
        const tb = b.lastSeen?.getTime() ?? 0;
        return tb - ta;
      }
      if (sort === "attempts") return (b.totalAttempts ?? 0) - (a.totalAttempts ?? 0);
      // priority
      return b.priority - a.priority;
    });

    return rows;
  }, [stats, questionById, qSearch, filter, sort]);

  const counts = useMemo(() => {
    let flagged = 0;
    let incorrect = 0;
    let low = 0;
    for (const r of merged) {
      if (r.flagged) flagged += 1;
      if (r.isIncorrectBucket) incorrect += 1;
      if (r.isLowConfidenceBucket) low += 1;
    }
    return { all: merged.length, flagged, incorrect, low };
  }, [merged]);

  const revisionIds = useMemo(() => {
    // Keep only IDs that still exist in the active bank (so Session page can load them).
    return merged.filter((r) => r.hasQuestion).map((r) => r.id);
  }, [merged]);

  const startRevisionHref = useMemo(() => {
    const ids = revisionIds.slice(0, 50).join(",");
    // Session page supports: ?mode=revise&ids=a,b,c
    return `/app/session?mode=revise&ids=${encodeURIComponent(ids)}`;
  }, [revisionIds]);

  // --------- UI ----------
  if (!authReady) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Preparing…</div>
        <div className="mt-2 text-sm text-white/70">Checking sign-in.</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Sign in required</div>
        <div className="mt-2 text-sm text-white/70">
          You need to sign in before you can access your revision bank.
        </div>
        <div className="mt-5">
          <Link href="/auth" className="btn btn-primary w-full sm:w-auto">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Loading revision bank…</div>
        <div className="mt-2 text-sm text-white/70">Fetching your saved question stats.</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Couldn’t load revision bank</div>
        <div className="mt-2 text-sm text-white/70">{err}</div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/app" className="btn btn-primary w-full sm:w-auto">
            Back to dashboard
          </Link>
          <Link href="/app/learn" className="btn btn-outline w-full sm:w-auto">
            Go to Learn
          </Link>
        </div>
      </div>
    );
  }

  const empty = merged.length === 0;

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Revision</div>
            <div className="mt-1 text-lg font-semibold text-white">Your Revision Bank</div>
            <div className="mt-2 text-sm text-white/70">
              Questions you’ve attempted before — quickly revisit what you flagged, got wrong, or felt unsure about.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">All: {counts.all}</span>
              <span className="chip">Flagged: {counts.flagged}</span>
              <span className="chip">Incorrect: {counts.incorrect}</span>
              <span className="chip">Low confidence: {counts.low}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Link
              href={startRevisionHref}
              className={[
                "btn btn-primary",
                empty || revisionIds.length === 0 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              aria-disabled={empty || revisionIds.length === 0}
            >
              Start revision (top {Math.min(50, revisionIds.length)})
            </Link>
            <Link href="/app/learn" className="btn btn-ghost">
              Browse Learn
            </Link>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { k: "all", label: "All" },
              { k: "flagged", label: "Flagged" },
              { k: "incorrect", label: "Incorrect" },
              { k: "lowConfidence", label: `Low confidence (≤${lowConfidenceThreshold})` },
            ].map((t) => (
              <button
                key={t.k}
                type="button"
                className={[
                  "btn px-3 py-2",
                  filter === (t.k as BankFilter) ? "btn-primary" : "btn-ghost",
                ].join(" ")}
                onClick={() => setFilter(t.k as BankFilter)}
                aria-pressed={filter === (t.k as BankFilter)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <input
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                placeholder="Search questions, topics, subtopics…"
                className={[
                  "w-full rounded-2xl border border-white/10 bg-white/5",
                  "px-4 py-3 text-sm text-white/90 outline-none",
                  "placeholder:text-white/35 focus:border-white/25",
                ].join(" ")}
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className={[
                "rounded-2xl border border-white/10 bg-white/5",
                "px-3 py-3 text-sm text-white/90 outline-none",
                "focus:border-white/25",
              ].join(" ")}
            >
              <option value="priority">Sort: Priority</option>
              <option value="recent">Sort: Most recent</option>
              <option value="attempts">Sort: Most attempts</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-white/55">
          Priority favours flagged questions, recent incorrect answers, and low confidence.
        </div>
      </div>

      {/* List */}
      {empty ? (
        <div className="card">
          <div className="text-sm font-semibold text-white">Nothing here yet</div>
          <div className="mt-2 text-sm text-white/70">
            Your revision bank fills up as you answer questions. Start a session from Learn, then come back here.
          </div>
          <div className="mt-5">
            <Link href="/app/learn" className="btn btn-primary w-full sm:w-auto">
              Start learning
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {merged.slice(0, 200).map((r) => {
            const lastSeenLabel = r.lastSeen ? dayKeyLocal(r.lastSeen) : "—";
            const acc = r.totalAttempts > 0 ? Math.round(r.accuracy * 100) : 0;

            return (
              <div key={r.id} className="card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.flagged ? <span className="chip">Flagged</span> : null}
                      {r.isIncorrectBucket ? <span className="chip">Incorrect</span> : null}
                      {r.isLowConfidenceBucket ? <span className="chip">Low confidence</span> : null}
                      {!r.hasQuestion ? <span className="chip">Unavailable</span> : null}
                    </div>

                    <div className="mt-2 text-sm font-semibold text-white">
                      {r.questionText ? r.questionText : "Question text unavailable"}
                    </div>

                    <div className="mt-2 text-xs text-white/60">
                      {r.moduleName || r.topic ? (
                        <>
                          {r.moduleName ? <span>{r.moduleName}</span> : null}
                          {r.moduleName && r.topic ? <span> • </span> : null}
                          {r.topic ? <span>{r.topic}</span> : null}
                          {r.subTopic ? <span> • {r.subTopic}</span> : null}
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-55">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span>Attempts</span>
                        <span className="text-white/85">{r.totalAttempts}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                        <span>Accuracy</span>
                        <span className="text-white/85">{acc}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                        <span>Last seen</span>
                        <span className="text-white/85">{lastSeenLabel}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                        <span>Confidence</span>
                        <span className="text-white/85">
                          {r.lastConfidence ? `${r.lastConfidence}/5` : "—"}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={
                        r.hasQuestion
                          ? `/app/session?mode=revise&ids=${encodeURIComponent(r.id)}`
                          : "#"
                      }
                      className={[
                        "btn btn-primary",
                        r.hasQuestion ? "" : "pointer-events-none opacity-50",
                      ].join(" ")}
                      aria-disabled={!r.hasQuestion}
                    >
                      Revise this
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {merged.length > 200 ? (
            <div className="card">
              <div className="text-sm text-white/80">
                Showing the first 200 items. Narrow your filters or search to find the rest.
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="text-xs text-white/50">
        Tip: if you want this to behave exactly like iOS (weakest-first), we can adjust the priority scoring to match your
        `startWeakRevisionSession()` logic (accuracy + lastSeen + minAttempts).
      </div>
    </div>
  );
}
