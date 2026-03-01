import { canonicalTopicKey } from "@/lib/topicKeys";
import type {
  ExamReadyMode,
  QuestionStatSnapshot,
  TopicAggregate,
  TopicLockStatus,
} from "./types";

const MIN_TOTAL_ATTEMPTS = 40;
const MIN_DISTINCT_QUESTIONS = 18;
const COVERAGE_TARGET = 20;
const READINESS_THRESHOLD = 0.82;
const ACCURACY_THRESHOLD = 0.78;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asCount(n: unknown): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
}

function asConfidence(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return clamp(v, 1, 5);
}

export function aggregateTopicStats(
  questionStats: QuestionStatSnapshot[],
): Record<string, TopicAggregate> {
  const byTopic = new Map<
    string,
    {
      totalAttempts: number;
      totalCorrect: number;
      confidenceSum: number;
      confidenceCount: number;
      questionIds: Set<string>;
    }
  >();

  for (const stat of questionStats) {
    const topicKey = canonicalTopicKey(stat.topic);
    if (!topicKey) continue;

    const totalAttempts = asCount(stat.totalAttempts);
    const correctCount = asCount(stat.correctCount);
    const incorrectCount = asCount(stat.incorrectCount);
    const derivedAttempts = Math.max(totalAttempts, correctCount + incorrectCount);

    const id = String(stat.questionId || stat.id || "").trim();
    const conf = asConfidence(stat.lastConfidence);

    const prev = byTopic.get(topicKey) ?? {
      totalAttempts: 0,
      totalCorrect: 0,
      confidenceSum: 0,
      confidenceCount: 0,
      questionIds: new Set<string>(),
    };

    prev.totalAttempts += derivedAttempts;
    prev.totalCorrect += correctCount;
    if (conf !== null) {
      prev.confidenceSum += conf;
      prev.confidenceCount += 1;
    }
    if (id) prev.questionIds.add(id);

    byTopic.set(topicKey, prev);
  }

  const out: Record<string, TopicAggregate> = {};
  for (const [topicKey, v] of byTopic.entries()) {
    out[topicKey] = {
      topicKey,
      totalAttempts: v.totalAttempts,
      totalCorrect: v.totalCorrect,
      distinctQuestionsAttempted: v.questionIds.size,
      avgLastConfidence:
        v.confidenceCount > 0 ? v.confidenceSum / v.confidenceCount : 3,
    };
  }
  return out;
}

export function computeReadinessScore(aggregate: TopicAggregate): number {
  const attempts = Math.max(0, aggregate.totalAttempts);
  const correct = Math.max(0, aggregate.totalCorrect);
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const coverage = clamp(aggregate.distinctQuestionsAttempted / COVERAGE_TARGET, 0, 1);
  const confidenceNorm = clamp((aggregate.avgLastConfidence - 1) / 4, 0, 1);

  return clamp(
    0.60 * accuracy + 0.25 * coverage + 0.15 * confidenceNorm,
    0,
    1,
  );
}

export function computeTopicLockStatus(
  aggregate: TopicAggregate,
  mode: ExamReadyMode,
): TopicLockStatus {
  const totalAttempts = Math.max(0, aggregate.totalAttempts);
  const totalCorrect = Math.max(0, aggregate.totalCorrect);
  const distinctQuestionsAttempted = Math.max(0, aggregate.distinctQuestionsAttempted);
  const avgLastConfidence = clamp(aggregate.avgLastConfidence, 1, 5);

  const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
  const coverage = clamp(distinctQuestionsAttempted / COVERAGE_TARGET, 0, 1);
  const confidenceNorm = clamp((avgLastConfidence - 1) / 4, 0, 1);
  const readinessScore = computeReadinessScore(aggregate);

  const eligible =
    totalAttempts >= MIN_TOTAL_ATTEMPTS &&
    distinctQuestionsAttempted >= MIN_DISTINCT_QUESTIONS;

  const locked =
    eligible &&
    readinessScore >= READINESS_THRESHOLD &&
    accuracy >= ACCURACY_THRESHOLD;

  const reason = !eligible
    ? "insufficient_sample"
    : locked
      ? "exam_ready"
      : "below_threshold";

  return {
    topicKey: aggregate.topicKey,
    mode,
    eligible,
    locked,
    reason,
    accuracy,
    coverage,
    confidenceNorm,
    readinessScore,
    totalAttempts,
    totalCorrect,
    distinctQuestionsAttempted,
    avgLastConfidence,
  };
}

export function computeTopicLockStatuses(
  questionStats: QuestionStatSnapshot[],
  mode: ExamReadyMode,
): Record<string, TopicLockStatus> {
  const aggregates = aggregateTopicStats(questionStats);
  const out: Record<string, TopicLockStatus> = {};

  for (const aggregate of Object.values(aggregates)) {
    out[aggregate.topicKey] = computeTopicLockStatus(aggregate, mode);
  }

  return out;
}

