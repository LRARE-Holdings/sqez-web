export type DemoUser = {
  name: string;
  exam: "SQE1" | "SQE2";
  daysToExam: number;
};

export type DemoSession = {
  title: string;
  focus: string;
  minutes: number;
  questions: number;
};

export type DemoMetrics = {
  streakDays: number;
  accuracy7d: number; // 0..1
  confidenceNet7d: number; // +/- points
  reviewedThisWeek: number;
};

export type DemoWeakArea = {
  topic: string;
  trend: "improving" | "stable" | "needs-work";
};

export const demoUser: DemoUser = {
  name: "Alex",
  exam: "SQE1",
  daysToExam: 68,
};

export const demoTodaySession: DemoSession = {
  title: "Today’s session",
  focus: "FLK1 • Contract",
  minutes: 12,
  questions: 10,
};

export const demoMetrics: DemoMetrics = {
  streakDays: 5,
  accuracy7d: 0.71,
  confidenceNet7d: 12,
  reviewedThisWeek: 34,
};

export const demoWeakAreas: DemoWeakArea[] = [
  { topic: "Misrepresentation", trend: "needs-work" },
  { topic: "Remedies", trend: "stable" },
  { topic: "Offer & acceptance", trend: "improving" },
  { topic: "Consideration", trend: "stable" },
];