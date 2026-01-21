export type SqeStage = "FLK1" | "FLK2" | "BOTH" | "SQE2" | "RETAKE";
export type ExamWindow = "0_3" | "3_6" | "6_12" | "UNSURE";
export type StudyPattern = "DAILY_SHORT" | "FEW_SESSIONS" | "ONE_LONG" | "VARIABLE";
export type Funding = "SELF" | "EMPLOYER" | "INSTITUTION" | "DECLINED";

export type Location = "UK" | "EU" | "INTL" | "DECLINED";
export type LegalBackground = "LAW" | "NON_LAW" | "CAREER_CHANGE" | "DECLINED";

export type OnboardingAnswers = {
  stage?: SqeStage;
  examWindow?: ExamWindow;
  studyPattern?: StudyPattern;
  funding?: Funding;

  location?: Location;
  legalBackground?: LegalBackground;
  university?: string; // optional free text
};

export type PlanRecommendation =
  | { kind: "MONTHLY"; runwayMonths: number }
  | { kind: "ANNUAL"; runwayMonths: number }
  | { kind: "COMPARE"; runwayMonths: number };

export function runwayMonthsFromExamWindow(w: ExamWindow | undefined): number {
  if (!w) return 3;
  if (w === "0_3") return 3;
  if (w === "3_6") return 6;
  if (w === "6_12") return 12;
  return 3; // UNSURE => start with 3 and reassess
}

export function recommendPlan(w: ExamWindow | undefined): PlanRecommendation {
  const months = runwayMonthsFromExamWindow(w);
  if (months <= 4) return { kind: "MONTHLY", runwayMonths: months };
  if (months >= 8) return { kind: "ANNUAL", runwayMonths: months };
  return { kind: "COMPARE", runwayMonths: months };
}