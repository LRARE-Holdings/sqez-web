export type ReviewSignal = {
  correct: boolean;
  confidence: number; // 1..5
  latencyMs: number;
  rationaleChars: number;
};

export type LearnerState = {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  avgResponseMs: number;
  confBias: number;
};

export type NextDueResult = {
  updated: LearnerState;
  nextDue: Date;
};

export const LRARE = {
  alpha: 0.35,
  beta: 0.25,
  gamma: 0.10,
  targetDifficulty: 0.60,
  k: 0.8,
  p: 1.1,

  defaultState(): LearnerState {
    return {
      stability: 1.0,
      difficulty: LRARE.targetDifficulty,
      reps: 0,
      lapses: 0,
      avgResponseMs: 0,
      confBias: 0,
    };
  },

  /**
   * Ported from Engine.swift where visible.
   * The `reps==0` branch is incomplete in the Swift file you uploaded,
   * so we use a compatible initialization that preserves the downstream math.
   */
  apply(signal: ReviewSignal, state: LearnerState, now: Date = new Date()): NextDueResult {
    const q = signal.correct ? 1.0 : 0.0;
    const c = clamp01((signal.confidence - 1) / 4);
    const r = clamp01(signal.rationaleChars / 140);
    let sig = 0.55 * q + 0.25 * c + 0.20 * r;

    if (signal.latencyMs > 15_000) sig *= 0.8;

    // --- Missing in uploaded Swift: reps==0 block + stability update logic.
    // We implement a conservative, monotonic update:
    // - stability increases with higher sig, decreases on wrong answers
    // - uses alpha/beta, and respects difficulty.
    const next: LearnerState = { ...state };

    if (next.reps === 0) {
      // sensible first-review baseline consistent with the rest of the engine
      next.stability = 1.0;
      next.difficulty = LRARE.targetDifficulty;
    }

    // Stability update (placeholder until exact Swift branch is provided)
    // More “quality” than difficulty -> stability increases.
    const qualityGap = sig - next.difficulty; // [-1..1]
    next.stability = clamp(next.stability * (1 + LRARE.alpha * qualityGap) + LRARE.beta * q, 0.2, 60);

    // Exact from Swift (visible)
    next.difficulty += LRARE.gamma * (LRARE.targetDifficulty - sig);
    next.difficulty = clamp(next.difficulty, 0.1, 0.95);

    next.reps += 1;
    if (!signal.correct) next.lapses += 1;

    const n = Math.max(1, next.reps);
    next.avgResponseMs =
      (next.avgResponseMs * (n - 1) + signal.latencyMs) / n;

    const correctnessAsConf = signal.correct ? 1.0 : 0.0;
    const biasSample = c - correctnessAsConf;
    next.confBias = 0.8 * next.confBias + 0.2 * biasSample;

    // Exact from Swift (visible)
    const intervalDays = LRARE.k * Math.pow(next.stability, LRARE.p);
    const nextDue = new Date(now.getTime() + intervalDays * 86_400 * 1000);

    return { updated: next, nextDue };
  },
};

export type ItemMeta = {
  id: string;
  dueAt: string; // ISO
  state: LearnerState;
  tags: string[];
  authorityIDs: string[];
};

export function composeSessionPool(items: ItemMeta[], now: Date = new Date(), cap: number = 30): string[] {
  const nowMs = now.getTime();
  const due = items.filter((i) => new Date(i.dueAt).getTime() <= nowMs);
  const nearDue = items.filter((i) => {
    const t = new Date(i.dueAt).getTime();
    return t > nowMs && t <= nowMs + 36_000 * 1000;
  });

  const pool = shuffle([...due, ...nearDue]).slice(0, cap);
  return pool.map((p) => p.id);
}

function clamp01(x: number) {
  return clamp(x, 0, 1);
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}