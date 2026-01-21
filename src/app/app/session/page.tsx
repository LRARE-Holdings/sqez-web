"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { seedQuestions } from "@/lib/questionSeed";
import { addAttempt, attemptFromQuestion } from "@/lib/storage";
import { composeSessionPool } from "@/lib/lrareKit";
import { applyReviewToItem, getItemMetas } from "@/lib/engineStore";

type Phase = "question" | "autopsy" | "done";

export default function SessionPage() {
  const [pool, setPool] = useState<string[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");

  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [rationale, setRationale] = useState("");

  const startRef = useRef<number>(0);

  useEffect(() => {
    // Build a session pool from due + near-due items (fallback to the first N).
    const existing = getItemMetas();

    const items = seedQuestions.map((sq) => {
      const found = existing.find((x) => x.id === sq.id);
      return (
        found ?? {
          id: sq.id,
          dueAt: new Date().toISOString(),
          state: {
            stability: 1,
            difficulty: 0.6,
            reps: 0,
            lapses: 0,
            avgResponseMs: 0,
            confBias: 0,
          },
          tags: [sq.module, sq.topic, sq.subTopic],
          authorityIDs: [],
        }
      );
    });

    const selected = composeSessionPool(items, new Date(), 10);
    const fallback = seedQuestions.slice(0, 10).map((s) => s.id);

    setPool(selected.length ? selected : fallback);
    setPoolIndex(0);
  }, []);

  const currentId = pool[poolIndex] ?? seedQuestions[0]?.id;
  const q =
    seedQuestions.find((x) => x.id === currentId) ?? seedQuestions[0];
  const isLast = poolIndex >= pool.length - 1;

  useEffect(() => {
    if (!q) return;
    startRef.current = performance.now();
    setSelected(null);
    setConfidence(3);
    setRationale("");
    setPhase("question");
  }, [poolIndex, q]);

  const isCorrect = useMemo(() => {
    if (selected === null) return false;
    return selected === q.answerIndex;
  }, [selected, q.answerIndex]);

  function submitAnswer() {
    if (selected === null) return;
    setPhase("autopsy");
  }

  function continueNext() {
    // store attempt
    const latencyMs = Math.max(0, Math.round(performance.now() - startRef.current));

    addAttempt(
      attemptFromQuestion({
        q,
        selectedIndex: selected ?? 0,
        latencyMs,
        confidence,
        rationaleChars: rationale.trim().length,
      }),
    );

    applyReviewToItem({
      id: q.id,
      signal: {
        correct: (selected ?? 0) === q.answerIndex,
        confidence,
        latencyMs,
        rationaleChars: rationale.trim().length,
      },
      tags: [q.module, q.topic, q.subTopic],
      authorityIDs: [],
    });

    if (isLast) {
      setPhase("done");
      return;
    }
    setPoolIndex((i) => i + 1);
  }

  if (phase === "done") {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Session complete</div>
        <div className="mt-2 text-sm text-white/70">
          You’ve finished today’s loop. Keep it small. Keep it consistent.
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/app" className="btn btn-primary w-full sm:w-auto">
            Back to dashboard
          </Link>
          <Link href="/app/review" className="btn btn-outline w-full sm:w-auto">
            Review history
          </Link>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">No questions</div>
        <div className="mt-2 text-sm text-white/70">
          Seed questions are missing. Please check your question seed file.
        </div>
        <div className="mt-5">
          <Link href="/app" className="btn btn-primary w-full sm:w-auto">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-white/60">
              Question {poolIndex + 1} of {pool.length || seedQuestions.length}
            </div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-white">
              {q.question}
            </div>
            <div className="mt-2 text-xs text-white/60">
              {q.module} • {q.topic} • {q.subTopic} • {q.difficulty}
            </div>
          </div>

          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Session
          </span>
        </div>

        <div className="mt-5 grid gap-2">
          {q.options.map((opt, i) => {
            const active = selected === i;
            const showResult = phase === "autopsy";
            const correct = i === q.answerIndex;
            const wrongPick = showResult && active && !correct;

            return (
              <button
                key={opt}
                type="button"
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left transition",
                  active ? "border-white/25 bg-white/7" : "border-white/10 bg-white/5 hover:bg-white/7",
                  showResult && correct ? "ring-1 ring-emerald-400/60" : "",
                  wrongPick ? "ring-1 ring-red-300/50" : "",
                ].join(" ")}
                onClick={() => {
                  if (phase !== "question") return;
                  setSelected(i);
                }}
                aria-pressed={active}
              >
                <div className="text-sm text-white/90">{opt}</div>
              </button>
            );
          })}
        </div>

        {phase === "question" ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={submitAnswer}
              disabled={selected === null}
            >
              Submit answer
            </button>
            <Link href="/app" className="btn btn-ghost w-full sm:w-auto">
              Exit
            </Link>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={continueNext}
            >
              {isLast ? "Finish session" : "Next question"}
            </button>
            <Link href="/app/review" className="btn btn-outline w-full sm:w-auto">
              Review history
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        <div className="card-soft px-4 py-4">
          <div className="text-sm font-semibold text-white">Autopsy</div>
          <div className="mt-2 text-sm text-white/80">
            {phase === "autopsy" ? (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-xs text-white/60">Result</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {isCorrect ? "Correct" : "Incorrect"}
                  </div>
                </div>

                <div className="mt-3 text-xs text-white/60">Explanation</div>
                <div className="mt-2 text-sm leading-relaxed text-white/80">
                  {q.explanation}
                </div>
              </>
            ) : (
              <div className="text-sm text-white/70">
                Submit your answer to unlock Autopsy Mode.
              </div>
            )}
          </div>
        </div>

        <div className="card-soft px-4 py-4">
          <div className="text-sm font-semibold text-white">Confidence check</div>
          <div className="mt-2 text-xs text-white/60">
            How confident were you when answering?
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = confidence === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={[
                    "rounded-xl border px-0 py-2 text-sm",
                    active ? "border-white/25 bg-white/7 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/7",
                  ].join(" ")}
                  onClick={() => setConfidence(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-white/75" htmlFor="rationale">
              Rationale (optional)
            </label>
            <textarea
              id="rationale"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              rows={4}
              placeholder="What was your reasoning? Keep it short."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
            <div className="mt-2 text-xs text-white/60">
              Used to improve insights (later).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}