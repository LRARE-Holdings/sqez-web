// src/lib/catalog/statutes.ts
export type Statute = {
  id: string;
  title: string;
  year?: number;
  short?: string;
  url?: string;
  topicKeys: string[];
  subtopics?: string[];
  tags?: string[];
  priority?: "core" | "useful";
};

// ✅ Seed data (placeholder) — move to Firestore later
export const STATUTES: Statute[] = [
  {
    id: "lra-2002",
    title: "Land Registration Act",
    year: 2002,
    short:
      "Registration, priority, notices/restrictions, overriding interests (headline).",
    url: "https://www.legislation.gov.uk/ukpga/2002/9/contents",
    topicKeys: ["land-law", "property-practice"],
    subtopics: ["Registration (LRA 2002)", "Title & Restrictions"],
    priority: "core",
    tags: ["registration", "priority"],
  },
  {
    id: "lpa-1925",
    title: "Law of Property Act",
    year: 1925,
    short:
      "Conveyancing framework: legal estates/interests, formalities, co-ownership.",
    url: "https://www.legislation.gov.uk/ukpga/Geo5/15-16/20/contents",
    topicKeys: ["land-law", "property-practice"],
    subtopics: ["Estates & Interests", "Co-ownership"],
    priority: "core",
    tags: ["estates", "formalities"],
  },
  {
    id: "mca-2005",
    title: "Mental Capacity Act",
    year: 2005,
    short: "Capacity and best interests (relevant across practice).",
    url: "https://www.legislation.gov.uk/ukpga/2005/9/contents",
    topicKeys: ["wills-and-administration-of-estates"],
    subtopics: ["Capacity"],
    priority: "useful",
    tags: ["capacity"],
  },
];

export function statutesForTopicKey(topicKey: string): Statute[] {
  if (!topicKey) return [];
  return STATUTES.filter((s) => s.topicKeys.includes(topicKey)).sort((a, b) => {
    const pa = a.priority === "core" ? 0 : 1;
    const pb = b.priority === "core" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}