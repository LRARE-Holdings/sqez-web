"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAttempts, type Attempt } from "@/lib/storage";

export default function ReviewPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    setAttempts(getAttempts());
  }, []);

  return (
    <div className="grid gap-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Review history</div>
            <div className="mt-2 text-sm text-white/70">
              Your recent attempts (local only for now).
            </div>
          </div>
          <Link href="/app/session" className="btn btn-primary px-3 py-2">
            Start session
          </Link>
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="card-soft px-4 py-4 text-sm text-white/70">
          No attempts yet. Run a session to populate your dashboard.
        </div>
      ) : (
        <div className="grid gap-3">
          {attempts.slice(0, 20).map((a) => (
            <div key={a.id} className="card-soft px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  {a.topic} • {a.subTopic}
                </div>
                <div className="text-xs text-white/60">
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="mt-2 text-sm text-white/85">{a.prompt}</div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-xs text-white/60">Result</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {a.signal.correct ? "Correct" : "Incorrect"} • Confidence {a.signal.confidence}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Latency {a.signal.latencyMs}ms • Rationale {a.signal.rationaleChars} chars
                </div>
              </div>

              <div className="mt-3 text-xs text-white/60">Explanation</div>
              <div className="mt-2 text-sm leading-relaxed text-white/80">
                {a.explanation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}