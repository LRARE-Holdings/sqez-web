export type ExamReadyMode = "observe" | "enforce";

export type QuestionStatSnapshot = {
  id: string;
  questionId?: string;
  topic?: string;
  totalAttempts?: number;
  correctCount?: number;
  incorrectCount?: number;
  lastConfidence?: number;
};

export type TopicAggregate = {
  topicKey: string;
  totalAttempts: number;
  totalCorrect: number;
  distinctQuestionsAttempted: number;
  avgLastConfidence: number;
};

export type TopicLockStatus = {
  topicKey: string;
  mode: ExamReadyMode;
  eligible: boolean;
  locked: boolean;
  reason: "insufficient_sample" | "below_threshold" | "exam_ready";
  accuracy: number;
  coverage: number;
  confidenceNorm: number;
  readinessScore: number;
  totalAttempts: number;
  totalCorrect: number;
  distinctQuestionsAttempted: number;
  avgLastConfidence: number;
};

export type ExamReadyHookResult = {
  ready: boolean;
  mode: ExamReadyMode;
  lockedTopicKeys: Set<string>;
  byTopic: Record<string, TopicLockStatus>;
  setTopicOverride: (topicKey: string) => boolean;
  hasTopicOverride: (topicKey: string) => boolean;
  consumeTopicOverride: (topicKey: string) => boolean;
};
