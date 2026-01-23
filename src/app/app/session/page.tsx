"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { byKey, byTitle } from "@/lib/topicCatalog";
import { fetchActiveQuestions } from "@/lib/questions/firestore";
import type { FireQuestion } from "@/lib/questions/types";

type Phase = "question" | "autopsy" | "done";
type Difficulty = "Easy" | "Medium" | "Hard";

type PendingAttempt = {
  questionId: string;
  correct: boolean;
  secondsSpent: number;
};

function normalizeDifficulty(v: string): Difficulty {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "easy") return "Easy";
  if (s === "hard") return "Hard";
  return "Medium";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shuffle<T>(arr: T[]) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function dayKeyUTC(d: Date) {
  // YYYY-MM-DD (UTC)
  return d.toISOString().slice(0, 10);
}

function isSameUTCDate(a: Date, b: Date) {
  return dayKeyUTC(a) === dayKeyUTC(b);
}

function isYesterdayUTC(prev: Date, now: Date) {
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return dayKeyUTC(prev) === dayKeyUTC(y);
}

export default function SessionPage() {
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");

  // Auth state
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Firestore question load
  const [questions, setQuestions] = useState<FireQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session state
  const [pool, setPool] = useState<string[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [selected, setSelected] = useState<number | null>(null);

  // Per-question capture
  const startRef = useRef<number>(0);
  const [pending, setPending] = useState<PendingAttempt | null>(null);

  // Confidence + flag + feedback
  const [confidence, setConfidence] = useState<number>(3); // 1..5
  const [flagged, setFlagged] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // --------- Auth listener ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // --------- Load questions ----------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadError(null);

      if (!authReady) {
        setLoading(true);
        return;
      }

      if (!authUser) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const active = await fetchActiveQuestions(500);
        if (cancelled) return;

        const decoded = topicParam ? decodeURIComponent(topicParam) : null;

        // Accept canonical key or human title.
        const topicMeta = decoded
          ? byKey(decoded) ??
            byKey(decoded.replace(/\s+/g, "")) ??
            byTitle(decoded)
          : undefined;

        const wantedTitle = topicMeta?.title ?? decoded ?? null;

        const scoped = wantedTitle
          ? active.filter((q) => {
              const a = (q.topic ?? "").trim().toLowerCase();
              const b = wantedTitle.trim().toLowerCase();
              return a === b;
            })
          : active;

        setQuestions(scoped);

        // Simple pool: shuffle and take 10 (or fewer).
        const ids = shuffle(scoped.map((q) => q.questionId)).slice(0, 10);
        setPool(ids);
        setPoolIndex(0);

        // Reset
        setPhase("question");
        setSelected(null);
        setPending(null);
        startRef.current = performance.now();

        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoading(false);
        setLoadError(
          e instanceof Error ? e.message : "Failed to load questions.",
        );
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [topicParam, authReady, authUser]);

  // --------- Derived current question ----------
  const currentId = pool[poolIndex];

  const q = useMemo(() => {
    if (!currentId) return undefined;
    return questions.find((x) => x.questionId === currentId);
  }, [questions, currentId]);

  const isCorrect = useMemo(() => {
    if (!q) return false;
    if (selected === null) return false;
    return selected === q.answerIndex;
  }, [selected, q]);

  const isLast = poolIndex >= pool.length - 1;

  // --------- Per-question reset/timer ----------
  useEffect(() => {
    if (!q) return;
    startRef.current = performance.now();
    setSelected(null);
    setPhase("question");
    setPending(null);

    // UX defaults per question
    setConfidence(3);
    setFlagged(false);
    setFeedback("");
    setShowFeedback(false);

    setSaving(false);
    setSaveError(null);
    setSaveOk(null);
  }, [q?.questionId]);

  // --------- Firestore writers ----------
  async function updateAccountStatsAndMetrics(args: {
    uid: string;
    correct: boolean;
    lrareScore0to100: number;
  }) {
    const { uid, correct, lrareScore0to100 } = args;

    const now = new Date();
    const todayKey = dayKeyUTC(now);

    // 1) Update users/{uid}/stats/current (totals + streak)
    const statsRef = doc(db, "users", uid, "stats", "current");

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);

      const data = snap.exists() ? (snap.data() as {
        totalAnswered?: number;
        totalCorrect?: number;
        streak?: number;
        longestStreak?: number;
        updatedAt?: { toDate?: () => Date };
      }) : {};

      const prevUpdated = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;

      const prevStreak = Number.isFinite(data.streak) ? Number(data.streak) : 0;
      const prevLongest = Number.isFinite(data.longestStreak) ? Number(data.longestStreak) : 0;

      let nextStreak = prevStreak;

      // We only have `updatedAt` to infer daily streak.
      // - Same day: keep streak.
      // - Yesterday: increment.
      // - Otherwise: reset to 1.
      if (!prevUpdated) {
        nextStreak = 1;
      } else if (isSameUTCDate(prevUpdated, now)) {
        nextStreak = prevStreak;
      } else if (isYesterdayUTC(prevUpdated, now)) {
        nextStreak = prevStreak + 1;
      } else {
        nextStreak = 1;
      }

      const nextLongest = Math.max(prevLongest, nextStreak);

      const totalAnswered = (Number.isFinite(data.totalAnswered) ? Number(data.totalAnswered) : 0) + 1;
      const totalCorrect = (Number.isFinite(data.totalCorrect) ? Number(data.totalCorrect) : 0) + (correct ? 1 : 0);

      tx.set(
        statsRef,
        {
          totalAnswered,
          totalCorrect,
          streak: nextStreak,
          longestStreak: nextLongest,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    // 2) Update users/{uid}/metrics/activityDaily (map of date -> int)
    const activityRef = doc(db, "users", uid, "metrics", "activityDaily");
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(activityRef);
      const cur = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const prev = Number.isFinite(cur[todayKey] as number) ? Number(cur[todayKey] as number) : 0;
      tx.set(activityRef, { ...cur, [todayKey]: Math.trunc(prev + 1) }, { merge: false });
    });

    // 3) Update users/{uid}/metrics/lrareDaily (map of date -> int)
    // Store a daily snapshot. Overwrite today’s value with the latest computed score.
    const lrareRef = doc(db, "users", uid, "metrics", "lrareDaily");
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(lrareRef);
      const cur = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const score = Math.trunc(clamp(lrareScore0to100, 0, 100));
      tx.set(lrareRef, { ...cur, [todayKey]: score }, { merge: false });
    });
  }

  async function writeQuestionStat(args: {
    uid: string;
    question: FireQuestion;
    correct: boolean;
    confidence1to5: number;
    secondsSpent: number;
    flaggedNow: boolean;
  }) {
    const { uid, question, correct, confidence1to5, secondsSpent, flaggedNow } =
      args;

    const statRef = doc(db, "users", uid, "questionStats", question.questionId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(statRef);
      const cur = snap.exists() ? (snap.data() as {
        correctCount?: number;
        incorrectCount?: number;
        totalAttempts?: number;
      }) : {};

      const prevCorrect = Number.isFinite(cur.correctCount) ? Number(cur.correctCount) : 0;
      const prevIncorrect = Number.isFinite(cur.incorrectCount) ? Number(cur.incorrectCount) : 0;
      const prevTotal = Number.isFinite(cur.totalAttempts) ? Number(cur.totalAttempts) : 0;

      const nextCorrect = prevCorrect + (correct ? 1 : 0);
      const nextIncorrect = prevIncorrect + (correct ? 0 : 1);
      const nextTotal = prevTotal + 1;

      tx.set(
        statRef,
        {
          correctCount: Math.trunc(nextCorrect),
          incorrectCount: Math.trunc(nextIncorrect),
          totalAttempts: Math.trunc(nextTotal),

          lastConfidence: Math.trunc(clamp(confidence1to5, 1, 5)),
          lastResult: correct ? "correct" : "incorrect",
          lastSeen: serverTimestamp(),

          module: question.module,
          topic: question.topic,
          questionId: question.questionId,

          timeSpentSeconds: Math.max(0, Math.round(secondsSpent)),
          updatedAt: serverTimestamp(),

          // Flagging (for later Revise build)
          flagged: Boolean(flaggedNow),
          ...(flaggedNow ? { flaggedAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );
    });
  }

  async function writeFeedback(args: {
    uid: string;
    question: FireQuestion;
    comment: string;
  }) {
    const { uid, question, comment } = args;
    const trimmed = comment.trim();
    if (!trimmed) return;

    await addDoc(collection(db, "questionFeedback"), {
      comment: trimmed,
      createdAt: serverTimestamp(),
      module: question.module,
      topic: question.topic,
      questionId: question.questionId,
      userId: uid,
    });
  }

  // --------- Handlers ----------
  function onSelect(idx: number) {
    if (phase !== "question") return;
    setSelected(idx);
  }

  function onSubmit() {
    if (!q) return;
    if (selected === null) return;

    const elapsedSec = Math.max(
      0,
      Math.round((performance.now() - startRef.current) / 1000),
    );

    setPending({
      questionId: q.questionId,
      correct: selected === q.answerIndex,
      secondsSpent: elapsedSec,
    });

    setPhase("autopsy");
  }

  async function onNext() {
    if (!q || !authUser || !pending) return;

    setSaving(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      await writeQuestionStat({
        uid: authUser.uid,
        question: q,
        correct: pending.correct,
        confidence1to5: confidence,
        secondsSpent: pending.secondsSpent,
        flaggedNow: flagged,
      });

      // Only write feedback if user actually opened it + typed something
      if (showFeedback && feedback.trim()) {
        await writeFeedback({
          uid: authUser.uid,
          question: q,
          comment: feedback,
        });
      }

      // Update aggregate stats + daily metrics for Progress screen
      // LRARE score (0-100): simple, stable mapping for now.
      const lrare = clamp(
        Math.round((pending.correct ? 60 : 35) + (confidence - 3) * 12),
        0,
        100,
      );

      await updateAccountStatsAndMetrics({
        uid: authUser.uid,
        correct: pending.correct,
        lrareScore0to100: lrare,
      });

      setSaveOk("Saved");

      if (isLast) {
        setPhase("done");
        setSaving(false);
        return;
      }

      setPoolIndex((v) => v + 1);
      setSaving(false);
    } catch (e: unknown) {
      setSaving(false);
      setSaveError(
        e instanceof Error ? e.message : "Couldn’t save. Please try again.",
      );
    }
  }

  // --------- Render ----------
  const view = useMemo(() => {
    if (!authReady) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">
            Preparing your session…
          </div>
          <div className="mt-2 text-sm text-white/70">Checking sign-in.</div>
        </div>
      );
    }

    if (!authUser) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">Sign in required</div>
          <div className="mt-2 text-sm text-white/70">
            You need to sign in before you can access questions.
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
          <div className="text-sm font-semibold text-white">Loading session…</div>
          <div className="mt-2 text-sm text-white/70">Fetching questions.</div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">
            Couldn’t load session
          </div>
          <div className="mt-2 text-sm text-white/70">{loadError}</div>
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

    if (!q) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">
            No questions available
          </div>
          <div className="mt-2 text-sm text-white/70">
            {topicParam
              ? "No active questions found for this topic."
              : "No active questions found."}
          </div>
          <div className="mt-5">
            <Link href="/app/learn" className="btn btn-primary w-full sm:w-auto">
              Back to Learn
            </Link>
          </div>
        </div>
      );
    }

    const meta = `${q.module} • ${q.topic} • ${q.subTopic} • ${normalizeDifficulty(
      q.difficulty,
    )}`;

    if (phase === "done") {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">Session complete</div>
          <div className="mt-2 text-sm text-white/70">
            Your stats have been saved.
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/app" className="btn btn-primary w-full sm:w-auto">
              Back to dashboard
            </Link>
            <Link href="/app/session" className="btn btn-outline w-full sm:w-auto">
              Start another session
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-white/60">
              Question {poolIndex + 1} of {pool.length}
              {topicParam ? <span className="ml-2 chip">Topic session</span> : null}
            </div>

            <div className="mt-2 text-sm font-semibold text-white">
              {q.question}
            </div>

            <div className="mt-2 text-xs text-white/60">{meta}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={[
                "btn btn-ghost px-3 py-2",
                flagged ? "border border-amber-200/20 bg-amber-200/10" : "",
              ].join(" ")}
              onClick={() => setFlagged((v) => !v)}
              aria-pressed={flagged}
            >
              {flagged ? "Flagged" : "Flag"}
            </button>

            <button
              type="button"
              className={[
                "btn btn-ghost px-3 py-2",
                showFeedback ? "border border-white/15 bg-white/10" : "",
              ].join(" ")}
              onClick={() => setShowFeedback((v) => !v)}
              aria-pressed={showFeedback}
            >
              {showFeedback ? "Feedback open" : "Feedback"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {q.options.map((opt, i) => {
            const chosen = selected === i;
            const showAnswer = phase === "autopsy";
            const correct = i === q.answerIndex;

            const cls =
              "w-full rounded-2xl border px-4 py-3 text-left text-sm transition " +
              (showAnswer
                ? correct
                  ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                  : chosen
                    ? "border-rose-400/40 bg-rose-400/10 text-white"
                    : "border-white/10 bg-white/5 text-white/85"
                : chosen
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/85 hover:bg-white/7");

            return (
              <button
                key={`${q.questionId}-${i}`}
                type="button"
                className={cls}
                onClick={() => onSelect(i)}
                disabled={phase !== "question"}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Confidence (pre-autopsy) */}
        {phase === "question" && selected !== null ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">
                How confident are you?
              </div>
              <span className="chip">{confidence} / 5</span>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2">
              {[
                { v: 1, label: "Guess" },
                { v: 2, label: "Low" },
                { v: 3, label: "OK" },
                { v: 4, label: "High" },
                { v: 5, label: "Certain" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  className={[
                    "rounded-xl border px-2 py-2 text-xs transition",
                    confidence === v
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                  onClick={() => setConfidence(v)}
                  disabled={phase !== "question"}
                  aria-pressed={confidence === v}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 text-xs text-white/55">
              Quick tip: be honest — it helps your future revision experience.
            </div>
          </div>
        ) : null}

        {phase === "question" && showFeedback ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-sm font-semibold text-white">Feedback</div>
            <div className="mt-2 text-xs text-white/60">
              Spotted an issue with the wording, answers, or explanation? Tell us — it’ll be attached to this question.
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Incorrect answer, unclear wording, missing explanation…"
              className={[
                "mt-3 w-full rounded-2xl border border-white/10 bg-white/5",
                "px-4 py-3 text-sm text-white/90 outline-none",
                "placeholder:text-white/35 focus:border-white/25",
              ].join(" ")}
              rows={4}
            />
            <div className="mt-2 text-xs text-white/55">
              We’ll send it when you move to the next question.
            </div>
          </div>
        ) : null}

        {phase === "autopsy" ? (
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-sm font-semibold text-white">
                {isCorrect ? "Correct" : "Incorrect"}
              </div>
              <div className="mt-2 text-xs text-white/60">
                Correct answer: <span className="text-white/80">{q.options[q.answerIndex]}</span>
              </div>
              <div className="mt-2 text-sm text-white/80">{q.explanation}</div>
            </div>

            {saveError ? (
              <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
                {saveError}
              </div>
            ) : null}

            {saveOk ? (
              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 px-4 py-3 text-sm text-emerald-50">
                {saveOk}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => void onNext()}
                disabled={saving}
              >
                {saving ? "Saving…" : isLast ? "Finish" : "Next question"}
              </button>

              <Link href="/app/learn" className="btn btn-ghost w-full sm:w-auto">
                Back to Learn
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={onSubmit}
              disabled={selected === null}
            >
              Check answer
            </button>

            <Link href="/app/learn" className="btn btn-ghost w-full sm:w-auto">
              Back to Learn
            </Link>
          </div>
        )}
      </div>
    );
  }, [
    authReady,
    authUser,
    loading,
    loadError,
    q,
    topicParam,
    poolIndex,
    pool.length,
    selected,
    phase,
    isCorrect,
    isLast,
    confidence,
    flagged,
    feedback,
    showFeedback,
    saving,
    saveError,
    saveOk,
  ]);

  return <div className="grid gap-6">{view}</div>;
}