"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import { byKey, byTitle } from "@/lib/topicCatalog";
import { fetchActiveQuestions } from "@/lib/questions/firestore";
import type { FireQuestion } from "@/lib/questions/types";

// Engine/attempt helpers (keep these imports exactly as in your project)
import { getItemMetas } from "@/lib/engineStore";

type Phase = "question" | "autopsy" | "done";
type Difficulty = "Easy" | "Medium" | "Hard";

function normalizeDifficulty(v: string): Difficulty {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "easy") return "Easy";
  if (s === "hard") return "Hard";
  return "Medium";
}

export default function SessionPage() {
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");

  // Auth state
  const [authReady, setAuthReady] = useState(false);
  const [userSignedIn, setUserSignedIn] = useState(false);

  // Firestore question load
  const [questions, setQuestions] = useState<FireQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session state
  const [pool, setPool] = useState<string[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [selected, setSelected] = useState<number | null>(null);

  // Perf timer for answering
  const startRef = useRef<number>(0);

  // --------- Auth listener (hook must always run) ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserSignedIn(Boolean(u));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // --------- Load questions (hook must always run) ----------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadError(null);

      // Don’t even attempt Firestore until auth has resolved and user is signed in.
      if (!authReady || !userSignedIn) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const active = await fetchActiveQuestions(500);
        if (cancelled) return;

        const decoded = topicParam ? decodeURIComponent(topicParam) : null;

        // Accept either canonical key (e.g. "DisputeResolution") or human title (e.g. "Dispute Resolution").
        const topicMeta = decoded
          ? byKey(decoded) ??
            byKey(decoded.replace(/\s+/g, "")) ??
            byTitle(decoded)
          : undefined;

        const wantedTitle = topicMeta?.title ?? decoded ?? null;

        const scoped = wantedTitle
          ? active.filter(
              (q) =>
                (q.topic ?? "").trim().toLowerCase() ===
                wantedTitle.trim().toLowerCase(),
            )
          : active;

        setQuestions(scoped);

        // Build engine pool from due items when possible
        const items = scoped.map((fq) => ({
          id: fq.questionId,
          tags: [fq.module, fq.topic, fq.subTopic],
        }));

        // Try to select due/near-due items from engine, fall back to first N
        const nowMs = Date.now();
        const metas = getItemMetas();

        const dueSet = new Set(
          metas
            .filter((m) => new Date(m.dueAt).getTime() <= nowMs)
            .map((m) => m.id),
        );

        const selectedIds = items
          .map((it) => it.id)
          .filter((id) => dueSet.has(id));

        const fallback = scoped.slice(0, 10).map((q) => q.questionId);

        setPool(selectedIds.length ? selectedIds : fallback);
        setPoolIndex(0);
        setPhase("question");
        setSelected(null);
        startRef.current = performance.now();

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setLoadError(
          e?.message ??
            "Failed to load questions from Firestore. Check permissions and auth.",
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [topicParam, authReady, userSignedIn]);

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
  }, [selected, q?.answerIndex]);

  const isLast = poolIndex >= pool.length - 1;

  // --------- Per-question reset/timer (hook must always run) ----------
  useEffect(() => {
    if (!q) return;
    startRef.current = performance.now();
    setSelected(null);
    setPhase("question");
  }, [q?.questionId]);

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

    // TODO: wire into LRARE engine persistence (engineStore) once exports are finalised.
    // For now, we still run the session UX (answer check + autopsy) without persisting.
    const attempt = {
      questionId: q.questionId,
      selectedIndex: selected,
      correct: selected === q.answerIndex,
      secondsSpent: elapsedSec,
      module: q.module,
      topic: q.topic,
      subTopic: q.subTopic,
      difficulty: normalizeDifficulty(q.difficulty),
    };

    void attempt;
    setPhase("autopsy");
  }

  function onNext() {
    if (isLast) {
      setPhase("done");
      return;
    }
    setPoolIndex((v) => v + 1);
  }

  // --------- Render (no early returns before hooks) ----------
  const view = useMemo(() => {
    if (!authReady) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">Checking sign-in…</div>
          <div className="mt-2 text-sm text-white/70">Preparing your session.</div>
        </div>
      );
    }

    if (!userSignedIn) {
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
          <div className="mt-2 text-sm text-white/70">
            Fetching questions from Firestore.
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">Couldn’t load session</div>
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
          <div className="text-sm font-semibold text-white">No questions available</div>
          <div className="mt-2 text-sm text-white/70">
            {topicParam
              ? "No active questions found for this topic."
              : "No active questions found in Firestore."}
          </div>
          <div className="mt-5">
            <Link href="/app/learn" className="btn btn-primary w-full sm:w-auto">
              Back to Learn
            </Link>
          </div>
        </div>
      );
    }

    const meta = `${q.module} • ${q.topic} • ${q.subTopic} • ${q.difficulty}`;

    if (phase === "done") {
      return (
        <div className="card">
          <div className="text-sm font-semibold text-white">Session complete</div>
          <div className="mt-2 text-sm text-white/70">
            Nice work — your engine has been updated.
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
            <div className="mt-2 text-sm font-semibold text-white">{q.question}</div>
            <div className="mt-2 text-xs text-white/60">{meta}</div>
          </div>

          <div className="text-xs text-white/60">
            Stability: <span className="text-white/80">—</span>
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
                key={`${currentId}-${i}`}
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

        {phase === "autopsy" ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-sm font-semibold text-white">
              {isCorrect ? "Correct" : "Not quite"}
            </div>
            <div className="mt-2 text-sm text-white/80">{q.explanation}</div>

            <div className="mt-4">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={onNext}
              >
                {isLast ? "Finish" : "Next question"}
              </button>
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
    userSignedIn,
    loading,
    loadError,
    q,
    poolIndex,
    pool.length,
    selected,
    phase,
    isCorrect,
    isLast,
    topicParam,
    currentId,
  ]);

  return <div className="grid gap-6">{view}</div>;
}