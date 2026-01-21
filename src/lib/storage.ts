import type { SeedQuestion } from "./questionSeed";

export type ReviewSignal = {
  correct: boolean;
  confidence: number; // 1..5
  latencyMs: number;
  rationaleChars: number;
};

export type Attempt = {
  id: string;
  questionId: string;
  module: string;
  topic: string;
  subTopic: string;
  difficulty: string;

  selectedIndex: number;
  correctIndex: number;

  createdAt: string; // ISO
  signal: ReviewSignal;

  explanation: string;
  prompt: string;
  options: string[];
};

const KEY = "sqez_attempts_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getAttempts(): Attempt[] {
  if (typeof window === "undefined") return [];
  return safeParse<Attempt[]>(window.localStorage.getItem(KEY), []);
}

export function saveAttempts(attempts: Attempt[]) {
  window.localStorage.setItem(KEY, JSON.stringify(attempts));
}

export function addAttempt(attempt: Attempt) {
  const all = getAttempts();
  all.unshift(attempt);
  saveAttempts(all.slice(0, 500)); // cap
}

export function attemptFromQuestion(args: {
  q: SeedQuestion;
  selectedIndex: number;
  latencyMs: number;
  confidence: number;
  rationaleChars: number;
}): Attempt {
  const { q, selectedIndex, latencyMs, confidence, rationaleChars } = args;
  const correct = selectedIndex === q.answerIndex;

  return {
    id: `${q.id}_${Date.now()}`,
    questionId: q.id,
    module: q.module,
    topic: q.topic,
    subTopic: q.subTopic,
    difficulty: q.difficulty,
    selectedIndex,
    correctIndex: q.answerIndex,
    createdAt: new Date().toISOString(),
    signal: {
      correct,
      confidence,
      latencyMs,
      rationaleChars,
    },
    explanation: q.explanation,
    prompt: q.question,
    options: q.options,
  };
}
