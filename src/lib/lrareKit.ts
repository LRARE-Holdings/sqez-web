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

export type ItemMeta = {
  id: string;
  dueAt: string; // ISO
  tags: string[];
  authorityIDs: string[];
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LRARE = {
  alpha: 0.35,
  beta: 0.25,
  gamma: 0.10,
  targetDifficulty: 0.60,
  k: 0.8,
  p: 1.1,

  defaultState(): LearnerState {
    // Mirrors the intent of Swift defaults:
    // stability 0, difficulty 0.5, others 0.
    return {
      stability: 0,
      difficulty: 0.5,
      reps: 0,
      lapses: 0,
      avgResponseMs: 0,
      confBias: 0,
    };
  },

  apply(signal: ReviewSignal, state: LearnerState, now: Date = new Date()): NextDueResult {
    const q = signal.correct ? 1.0 : 0.0;

    // Swift:
    // c = max(0, min(1, (confidence-1)/4))
    // r = max(0, min(1, rationaleChars/140))
    const c = clamp((signal.confidence - 1.0) / 4.0, 0.0, 1.0);
    const r = clamp(signal.rationaleChars / 140.0, 0.0, 1.0);

    // Swift:
    // sig = 0.55*q + 0.25*c + 0.20*r
    let sig = 0.55 * q + 0.25 * c + 0.20 * r;

    // Swift:
    // if latencyMs > 15000 { sig *= 0.8 }
    if (signal.latencyMs > 15_000) sig *= 0.8;

    const next: LearnerState = { ...state };

    // Swift:
    // if reps == 0:
    //   stability = clamp(1.5 + 2*difficulty, 0.3..365)
    // else:
    //   stability = stability * (1 + alpha*sig - beta*(1-sig))
    //   stability = clamp(stability, 0.3..365)
    if (next.reps === 0) {
      next.stability = clamp(1.5 + 2.0 * next.difficulty, 0.3, 365.0);
    } else {
      next.stability =
        next.stability * (1.0 + LRARE.alpha * sig - LRARE.beta * (1.0 - sig));
      next.stability = clamp(next.stability, 0.3, 365.0);
    }

    // Swift:
    // difficulty += gamma*(targetDifficulty - sig)
    // clamp 0.1..0.95
    next.difficulty += LRARE.gamma * (LRARE.targetDifficulty - sig);
    next.difficulty = clamp(next.difficulty, 0.1, 0.95);

    // Swift:
    // reps += 1; if !correct lapses += 1
    next.reps += 1;
    if (!signal.correct) next.lapses += 1;

    // Swift:
    // n = max(1, reps)
    // avgResponseMs = (avgResponseMs*(n-1) + latency)/n
    const n = Math.max(1, next.reps);
    next.avgResponseMs =
      (next.avgResponseMs * (n - 1) + signal.latencyMs) / n;

    // Swift:
    // correctnessAsConf = correct ? 1 : 0
    // biasSample = c - correctnessAsConf
    // confBias = 0.8*confBias + 0.2*biasSample
    const correctnessAsConf = signal.correct ? 1.0 : 0.0;
    const biasSample = c - correctnessAsConf;
    next.confBias = 0.8 * next.confBias + 0.2 * biasSample;

    // Swift:
    // intervalDays = k * pow(stability, p)
    // nextDue = now + Int(intervalDays*86400) seconds
    const intervalDays = LRARE.k * Math.pow(next.stability, LRARE.p);
    const nextDue = new Date(now.getTime() + Math.floor(intervalDays * 86_400) * 1000);

    return { updated: next, nextDue };
  },
};

export function composeSessionPool(
  items: ItemMeta[],
  now: Date = new Date(),
  cap: number = 30,
): string[] {
  const nowMs = now.getTime();
  const due = items.filter((m) => new Date(m.dueAt).getTime() <= nowMs);
  const nearDue = items.filter((m) => {
    const t = new Date(m.dueAt).getTime();
    return t > nowMs && t <= nowMs + 36_000 * 1000;
  });

  // Swift:
  // seed = (due + nearDue.shuffled().prefix(max(5, cap/5))).shuffled()
  const mixed = shuffled([...due, ...nearDue]);
  const take = Math.max(5, Math.floor(cap / 5));
  const seed = shuffled(mixed.slice(0, take));

  // Swift:
  // avoid repeating same tag in a row (with a skip rule on odd positions)
  const result: string[] = [];
  let lastTags: string[] = [];

  for (const meta of seed) {
    const sameTagInRow =
      lastTags.length > 0 && meta.tags.some((t) => lastTags.includes(t));
    if (sameTagInRow && result.length % 2 === 1) continue;

    result.push(meta.id);
    lastTags = meta.tags;

    if (result.length >= cap) break;
  }

  return result;
}
