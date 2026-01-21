export type SeedQuestion = {
  id: string;
  module: string;
  topic: string;
  subTopic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export const seedQuestions: SeedQuestion[] = [
  {
    id: "FLK1_CON_001",
    module: "FLK1",
    topic: "Contract",
    subTopic: "Offer & acceptance",
    difficulty: "Easy",
    question:
      "An offer can generally be withdrawn at any time before acceptance, unless it is…",
    options: [
      "Supported by consideration as an option contract",
      "Communicated only by email",
      "Made to the public at large",
      "Accepted by post",
    ],
    answerIndex: 0,
    explanation:
      "An option is only binding if supported by consideration. Otherwise, the offeror can generally revoke before acceptance (subject to communication rules).",
  },
  {
    id: "FLK1_CON_002",
    module: "FLK1",
    topic: "Contract",
    subTopic: "Consideration",
    difficulty: "Medium",
    question:
      "Which statement best reflects the rule on past consideration?",
    options: [
      "Past consideration is always good consideration",
      "Past consideration is not good consideration (subject to narrow exceptions)",
      "Past consideration is good if the promise is written",
      "Past consideration is good if the benefit was substantial",
    ],
    answerIndex: 1,
    explanation:
      "As a rule, past consideration is not good consideration. There are narrow exceptions (e.g., requested act with implied promise) but the baseline rule is ‘not good’.",
  },
  {
    id: "FLK1_CON_003",
    module: "FLK1",
    topic: "Contract",
    subTopic: "Misrepresentation",
    difficulty: "Hard",
    question:
      "A claimant rescinds for misrepresentation. Which factor most commonly bars rescission?",
    options: [
      "The misrepresentation was innocent",
      "Affirmation after discovering the truth",
      "The claimant suffered loss",
      "The contract was in writing",
    ],
    answerIndex: 1,
    explanation:
      "Rescission may be barred by affirmation, lapse of time, impossibility of restitution, or third-party rights. Affirmation after knowledge is a classic bar.",
  },
];