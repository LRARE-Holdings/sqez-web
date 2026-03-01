"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  type Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { canonicalTopicKey } from "@/lib/topicKeys";
import { logExamReadyEvent, useExamReadyLock } from "@/lib/examReadyLock";

type Focus = "failed" | "lowConfidence" | "flagged" | "mixed";
type TimeRange = "7" | "30" | "all";

type QuestionStat = {
  // web session writer fields
  totalAttempts?: number;
  correctCount?: number;
  incorrectCount?: number;
  lastResult?: "correct" | "incorrect" | string;
  lastConfidence?: number;
  lastSeen?: Timestamp; // usually serverTimestamp resolved
  flagged?: boolean;

  module?: string;
  topic?: string;
  questionId?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function daysAgoMs(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  // Firestore Timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (typeof anyV?.toMillis === "function") return anyV.toMillis();
  if (typeof anyV?.toDate === "function") return anyV.toDate().getTime();
  return null;
}

function accuracyOf(s: QuestionStat): number {
  const total =
    Number.isFinite(s.totalAttempts) ? Number(s.totalAttempts) : 0;
  const correct =
    Number.isFinite(s.correctCount) ? Number(s.correctCount) : 0;
  if (total <= 0) return 1; // treat unseen as "not weak" by default
  return correct / total;
}

function focusMeta(f: Focus) {
  switch (f) {
    case "failed":
      return {
        title: "Failed",
        subtitle: "Questions you got wrong",
        icon: "✕",
      };
    case "lowConfidence":
      return {
        title: "Low confidence",
        subtitle: "Questions you weren’t sure about",
        icon: "!",
      };
    case "flagged":
      return {
        title: "Flagged",
        subtitle: "Questions you flagged to revisit",
        icon: "⚑",
      };
    case "mixed":
      return {
        title: "Smart mix",
        subtitle: "A smart blend of all three",
        icon: "✦",
      };
  }
}

function timeRangeTitle(t: TimeRange) {
  if (t === "7") return "7 days";
  if (t === "30") return "30 days";
  return "All time";
}

export default function RevisePage() {
  const router = useRouter();
  const examReady = useExamReadyLock();

  // Auth
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Profile + entitlement (Firestore UI truth)
  const [firstName, setFirstName] = useState<string>("");
  const [isPro, setIsPro] = useState<boolean>(false);

  // UI state (mirrors ReviseView.swift)
  const [focus, setFocus] = useState<Focus>("failed");
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");

  // UX
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [noBank, setNoBank] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const userUnsubRef = useRef<(() => void) | null>(null);

  // --- Auth listener ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // --- Firestore user listener (firstName + isPro) ---
  useEffect(() => {
    // cleanup prior
    if (userUnsubRef.current) {
      userUnsubRef.current();
      userUnsubRef.current = null;
    }

    if (!authReady || !authUser) return;

    const ref = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() ?? {};
        const fn = (data.firstName as string | undefined) ?? "";
        const pro = (data.isPro as boolean | undefined) ?? false;

        setFirstName(fn);
        setIsPro(Boolean(pro));
      },
      () => {
        // Don’t hard-fail UI if listener breaks; keep last values.
      },
    );

    userUnsubRef.current = unsub;
    return () => {
      unsub();
      userUnsubRef.current = null;
    };
  }, [authReady, authUser]);

  async function buildRevisionIDs(args: {
    uid: string;
    cap: number;
    focus: Focus;
    timeRange: TimeRange;
    mode: "observe" | "enforce";
    lockedTopicKeys: Set<string>;
  }): Promise<string[]> {
    const { uid, cap, focus, timeRange, mode, lockedTopicKeys } = args;

    const snap = await getDocs(collection(db, "users", uid, "questionStats"));

    const now = Date.now();
    const minMs =
      timeRange === "7"
        ? daysAgoMs(7)
        : timeRange === "30"
          ? daysAgoMs(30)
          : null;

    const stats = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const s: QuestionStat = data as unknown as QuestionStat;

      // document id is the question id in your iOS/web writer
      const id = d.id;

      const lastSeenMs =
        tsToMs(s.lastSeen) ??
        tsToMs((data.lastSeen as unknown) ?? null) ??
        null;

      return {
        id,
        stat: s,
        topicKey: canonicalTopicKey(s.topic),
        lastSeenMs,
        acc: accuracyOf(s),
      };
    });

    const inWindow = stats.filter((x) => {
      if (!minMs) return true;
      if (!x.lastSeenMs) return false;
      return x.lastSeenMs >= minMs;
    });

    const passesFocus = inWindow.filter((x) => {
      const s = x.stat;

      const wasIncorrect =
        (s.lastResult ?? "").toString().toLowerCase() === "incorrect";

      const conf =
        Number.isFinite(s.lastConfidence) ? Number(s.lastConfidence) : null;

      const lowConf = conf !== null ? conf <= 2 : false;

      const flagged = Boolean(s.flagged);

      if (focus === "failed") return wasIncorrect;
      if (focus === "lowConfidence") return lowConf;
      if (focus === "flagged") return flagged;

      // mixed: union (failed OR lowConf OR flagged)
      return wasIncorrect || lowConf || flagged;
    });

    const unlockedOnly = passesFocus.filter((x) => {
      if (!x.topicKey) return true;
      return !lockedTopicKeys.has(x.topicKey);
    });

    if (mode === "observe" && unlockedOnly.length < passesFocus.length) {
      logExamReadyEvent("lock_would_block", {
        scope: "revise",
        wouldExclude: passesFocus.length - unlockedOnly.length,
        route: "revise",
      });
    }

    const target = mode === "enforce" ? unlockedOnly : passesFocus;

    // “Weakest first”:
    // - lowest accuracy first
    // - tie-breaker: oldest lastSeen first (stale gets priority)
    const sorted = target.sort((a, b) => {
      if (a.acc !== b.acc) return a.acc - b.acc;
      const aSeen = a.lastSeenMs ?? 0;
      const bSeen = b.lastSeenMs ?? 0;
      return aSeen - bSeen;
    });

    const ids = sorted.map((x) => x.id).filter(Boolean);
    return ids.slice(0, cap);
  }

  async function startRevision(cap: number) {
    if (!authUser) return;
    if (!examReady.ready) {
      setErr("Preparing topic readiness… please try again.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNoBank(false);

    try {
      const ids = await buildRevisionIDs({
        uid: authUser.uid,
        cap,
        focus,
        timeRange,
        mode: examReady.mode,
        lockedTopicKeys: examReady.lockedTopicKeys,
      });

      if (ids.length <= 0) {
        setNoBank(true);
        setBusy(false);
        return;
      }

      // We’ll wire session/page.tsx to accept mode=revise&ids=...
      const qs = new URLSearchParams();
      qs.set("mode", "revise");
      qs.set("ids", ids.join(","));
      router.push(`/app/session?${qs.toString()}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn’t start revision.");
      setBusy(false);
    }
  }

  const greetingName = useMemo(() => {
    const n = firstName.trim();
    return n.length ? n : "there";
  }, [firstName]);

  const focusInfo = focusMeta(focus);


  // ---------- Main UI ----------
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="min-w-0">
    <div className="text-2xl font-semibold tracking-tight text-white">
      Revise
    </div>
    <div className="mt-1 text-sm text-white/70">
      Focus your revision and drill what matters.
    </div>
  </div>
</div>



      

      {/* Focus picker */}
      <div className="card">
        <div className="text-xs text-white/60">Focus on</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {([
            { k: "failed", label: "Failed" },
            { k: "lowConfidence", label: "Low confidence" },
            { k: "flagged", label: "Flagged" },
            { k: "mixed", label: "Smart mix" },
          ] as Array<{ k: Focus; label: string }>).map((x) => {
            const selected = focus === x.k;
            return (
              <button
                key={x.k}
                type="button"
                className={[
                  "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition",
                  selected
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
                ].join(" ")}
                onClick={() => setFocus(x.k)}
                aria-pressed={selected}
              >
                {x.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-sm text-white/70">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-white/80">
            {focusInfo.icon}
          </span>
          <span className="font-semibold text-white">{focusInfo.title}:</span>{" "}
          {focusInfo.subtitle}
        </div>
      </div>

      {/* Session setup */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Session setup</div>
            <div className="mt-1 text-xs text-white/60">
              SQEz will pull questions from your bank in this window.
            </div>
          </div>
          <span className="chip">{timeRangeTitle(timeRange)}</span>
        </div>

        {/* Count slider */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/80">Number of questions</div>
            <div className="text-sm font-semibold text-white">
              {Math.trunc(questionCount)}
            </div>
          </div>
          <input
            className="mt-3 w-full"
            type="range"
            min={10}
            max={50}
            step={5}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-white/55">
            <span>Short</span>
            <span>Intense</span>
          </div>
        </div>

        {/* Time range segmented */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-2">
          <div className="grid grid-cols-3 gap-2">
            {([
              { k: "7", label: "7 days" },
              { k: "30", label: "30 days" },
              { k: "all", label: "All time" },
            ] as Array<{ k: TimeRange; label: string }>).map((x) => {
              const selected = timeRange === x.k;
              return (
                <button
                  key={x.k}
                  type="button"
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    selected
                      ? "border-white/25 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                  onClick={() => setTimeRange(x.k)}
                  aria-pressed={selected}
                >
                  {x.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Helper copy */}
        <div className="mt-4 flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="mt-0.5 text-white/80">✦</div>
          <div>
            <div className="text-sm font-semibold text-white">
              Smart revision sessions
            </div>
            <div className="mt-1 text-xs text-white/60">
              Focus on questions you missed, struggled with or flagged — in the
              selected window.
            </div>
          </div>
        </div>

        {/* Start button (Pro-gated) */}
        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        {noBank ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            No revision questions yet. Answer some questions in Learn or Practice
            first and we’ll automatically build your bank.
          </div>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              if (!isPro) {
                setShowPaywall(true);
                return;
              }
              void startRevision(Math.trunc(questionCount));
            }}
            disabled={busy || !examReady.ready}
          >
            {busy
              ? "Starting…"
              : isPro
                ? "Start revision"
                : "Unlock with SQEz Pro"}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="text-sm font-semibold text-white">Quick actions</div>
        <div className="mt-1 text-xs text-white/60">
          One-tap ways to jump into targeted revision from your bank.
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            {
              title: "Short drill",
              subtitle: "10-question burst from your revision bank.",
              icon: "⚡",
              cap: 10,
            },
            {
              title: "Standard session",
              subtitle: "20 questions focused on your weakest areas.",
              icon: "◎",
              cap: 20,
            },
            {
              title: "Endurance run",
              subtitle: "40-question deep dive into tricky questions.",
              icon: "🔥",
              cap: 40,
            },
          ].map((x) => (
            <button
              key={x.title}
              type="button"
              className={[
                "rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition",
                "hover:bg-white/7",
              ].join(" ")}
              onClick={() => {
                if (!isPro) {
                  setShowPaywall(true);
                  return;
                }
                void startRevision(x.cap);
              }}
              disabled={busy || !examReady.ready}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/85">
                  {x.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {x.title}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{x.subtitle}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bank card */}
      <Link href="/app/revision-bank" className="card block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/85">
              ▤
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                Your revision bank
              </div>
              <div className="mt-1 text-xs text-white/60">
                See every question you’ve struggled with, filtered by topic and
                subtopic.
              </div>
            </div>
          </div>

          <div className="text-white/60">›</div>
        </div>
      </Link>
    </div>
  );
}
