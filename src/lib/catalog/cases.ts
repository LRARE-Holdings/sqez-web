// src/lib/catalog/cases.ts
export type CaseItem = {
  id: string;
  name: string;
  citation?: string;
  year?: string;
  court?: string;
  summary: string;
  topicKeys: string[];
  subtopics?: string[];
  tags?: string[];
};

// ✅ Seed data (placeholder) — move to Firestore later
export const CASES: CaseItem[] = [
  {
    id: "donoghue-v-stevenson",
    name: "Donoghue v Stevenson",
    citation: "[1932] AC 562",
    year: "1932",
    court: "HL",
    summary:
      "Established the modern duty of care in negligence (neighbour principle).",
    topicKeys: ["tort-law"],
    subtopics: ["Duty & Standard", "Negligent Misstatement"],
    tags: ["negligence", "duty"],
  },
  {
    id: "carlill-v-carbolic-smoke-ball",
    name: "Carlill v Carbolic Smoke Ball Co",
    citation: "[1893] 1 QB 256",
    year: "1893",
    court: "CA",
    summary:
      "Unilateral offers and acceptance by performance; intention in adverts.",
    topicKeys: ["contract-law"],
    subtopics: ["Offer & Acceptance", "Intention & Formalities"],
    tags: ["offer", "acceptance"],
  },
  {
    id: "salomon-v-salomon",
    name: "Salomon v A Salomon & Co Ltd",
    citation: "[1897] AC 22",
    year: "1897",
    court: "HL",
    summary:
      "Separate legal personality of a company; foundational company law case.",
    topicKeys: ["business-law-and-practice"],
    subtopics: ["Company Formation", "Corporate Governance"],
    tags: ["company", "separate personality"],
  },
];

export function casesForTopicKey(topicKey: string): CaseItem[] {
  if (!topicKey) return [];
  return CASES.filter((c) => c.topicKeys.includes(topicKey)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}