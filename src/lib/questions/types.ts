export type SQEzModule = "FLK1" | "FLK2";

export type FireQuestion = {
  active: boolean;
  answerIndex: 0 | 1 | 2 | 3;
  createdAt: unknown; // Firestore Timestamp (keep loose on client)
  createdByUid: string;
  difficulty: string;
  explanation: string;
  module: SQEzModule;
  options: [string, string, string, string];
  question: string;
  questionId: string; // NOTE: your field is `questiondId` right now—see below
  subTopic: string;
  topic: string;
};