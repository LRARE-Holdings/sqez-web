// src/lib/catalog/subtopics.ts
// Derived from iOS SubtopicsCatalog.swift
//
// Purpose:
// - Provide a stable, client-safe subtopics catalog for Learn topic pages.
// - Works with `learn/[key]/page.tsx` via:
//   - subtopicsForTopicKey(topic.key)
//   - isValidSubtopic(topic.key, subtopic)

import { canonicalTopicKey } from "@/lib/topicKeys";

export type TopicKey =
  | "business-law-and-practice"
  | "dispute-resolution"
  | "contract-law"
  | "tort-law"
  | "legal-system-of-england-and-wales"
  | "constitutional-administrative-eu-legal-services"
  | "property-practice"
  | "wills-and-administration-of-estates"
  | "solicitors-accounts"
  | "land-law"
  | "trusts"
  | "criminal-law-and-practice";

export type TopicName =
  | "Business Law and Practice"
  | "Dispute Resolution"
  | "Contract Law"
  | "Tort Law"
  | "Legal System of England and Wales"
  | "Constitutional & Administrative / EU / Legal Services"
  | "Property Practice"
  | "Wills & Administration of Estates"
  | "Solicitors Accounts"
  | "Land Law"
  | "Trusts"
  | "Criminal Law & Practice";

export const TOPIC_KEY_TO_NAME: Record<TopicKey, TopicName> = {
  "business-law-and-practice": "Business Law and Practice",
  "dispute-resolution": "Dispute Resolution",
  "contract-law": "Contract Law",
  "tort-law": "Tort Law",
  "legal-system-of-england-and-wales": "Legal System of England and Wales",
  "constitutional-administrative-eu-legal-services":
    "Constitutional & Administrative / EU / Legal Services",
  "property-practice": "Property Practice",
  "wills-and-administration-of-estates": "Wills & Administration of Estates",
  "solicitors-accounts": "Solicitors Accounts",
  "land-law": "Land Law",
  trusts: "Trusts",
  "criminal-law-and-practice": "Criminal Law & Practice",
};

// Some older content may reference alternate labels.
// Keep lookups stable.
const NAME_ALIASES_TO_CANONICAL: Record<string, TopicName> = {
  "Criminal Law and Practice": "Criminal Law & Practice",
  "Constitutional / Administrative / EU / Legal Services":
    "Constitutional & Administrative / EU / Legal Services",
};

export const SUBTOPICS_BY_TOPIC_NAME: Record<TopicName, readonly string[]> = {
  "Business Law and Practice": [
    "Company Formation",
    "Directors’ Duties",
    "Share Capital & Pre-emption",
    "Debt & Security",
    "Meetings & Resolutions",
    "Members’ Remedies",
    "Corporate Governance",
    "Insolvency Overview",
    "Constitution & Articles",
    "Share Transfers",
  ],
  "Dispute Resolution": [
    "CPR & Overriding Objective",
    "Jurisdiction & Commencement",
    "Interim Remedies & Injunctions",
    "Case Management & Tracks",
    "Disclosure & Evidence",
    "Summary Judgment & Strike-Out",
    "Costs & Funding",
    "ADR & Settlement",
    "Judgment & Enforcement",
    "Appeals",
  ],
  "Contract Law": [
    "Offer & Acceptance",
    "Consideration",
    "Intention & Formalities",
    "Terms & Interpretation",
    "Exclusion & Unfair Terms",
    "Breach & Remedies",
    "Frustration",
    "Misrepresentation",
    "Duress & Undue Influence",
    "Privity",
  ],
  "Tort Law": [
    "Duty & Standard",
    "Causation & Remoteness",
    "Negligent Misstatement",
    "Vicarious Liability",
    "Occupiers’ Liability",
    "Nuisance & Rylands",
    "Defences",
    "Damages",
    "Limitation",
    "Product Liability",
  ],
  "Legal System of England and Wales": [
    "Court Structure",
    "Sources of Law",
    "Standards of Proof",
    "Precedent & Interpretation",
    "ADR & Costs",
    "Professional Conduct",
    "Civil vs Criminal",
    "Tribunals",
    "Access to Justice",
    "Case Management",
  ],
  "Constitutional & Administrative / EU / Legal Services": [
    "Separation of Powers",
    "Judicial Review Grounds",
    "Human Rights (HRA)",
    "Devolution",
    "Retained EU Law",
    "Parliamentary Sovereignty",
    "Rule of Law",
    "Public Bodies & Powers",
    "Remedies",
    "Legal Services Regulation",
  ],
  "Property Practice": [
    "Searches",
    "Title & Restrictions",
    "Contracts & Exchange",
    "Pre-completion",
    "Completion",
    "Registration",
    "Charges & CHG1",
    "OS1/OS2 Priority",
    "Enquiries (TA Forms)",
    "Leasehold Points",
  ],
  "Wills & Administration of Estates": [
    "Formalities",
    "Capacity",
    "Grants",
    "Family Provision (1975 Act)",
    "Ademption",
    "Residue & Abatement",
    "PR Duties",
    "Intestacy",
    "Will Construction",
    "Caveats",
  ],
  "Solicitors Accounts": [
    "Client vs Office Money",
    "Receipts & Payments",
    "Transfers to Office",
    "Residual Balances",
    "Interest Policy",
    "Reconciliations",
    "Record-Keeping",
    "Breach & Reporting",
    "Stakeholder Funds",
    "MLR & CDD",
  ],
  "Land Law": [
    "Estates & Interests",
    "Registration (LRA 2002)",
    "Overriding Interests",
    "Overreaching",
    "Co-ownership",
    "Easements",
    "Covenants",
    "Adverse Possession",
    "Proprietary Estoppel",
    "Leases & Licences",
  ],
  Trusts: [
    "Three Certainties",
    "Constitution",
    "Duties & Powers",
    "Resulting Trusts",
    "Constructive Trusts",
    "Breach & Remedies",
    "Tracing",
    "Saunders v Vautier",
    "Charitable Trusts",
    "Formalities for Land",
  ],
  "Criminal Law & Practice": [
    "Elements (AR/MR)",
    "Offences Against the Person",
    "Property Offences",
    "Inchoate Liability",
    "Defences",
    "Mode of Trial",
    "Bail",
    "Sentencing",
    "Procedure",
    "Appeals",
  ],
};

function normalize(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'"); // normalise curly apostrophes
}

/**
 * Returns the canonical TopicName for a TopicKey if it exists.
 */
export function topicNameForKey(key: string): TopicName | null {
  const raw = (key || "").trim().toLowerCase() as TopicKey;
  if (TOPIC_KEY_TO_NAME[raw]) {
    return TOPIC_KEY_TO_NAME[raw] as TopicName;
  }

  const canonical = canonicalTopicKey(key);
  if (!canonical) return null;

  const canonicalToLegacy: Record<string, TopicKey> = {
    BusinessLawandPractice: "business-law-and-practice",
    DisputeResolution: "dispute-resolution",
    Contract: "contract-law",
    Tort: "tort-law",
    LegalSystemofEnglandandWales: "legal-system-of-england-and-wales",
    ConstitutionalAdministrativeEULegalServices:
      "constitutional-administrative-eu-legal-services",
    PropertyPractice: "property-practice",
    WillsAndProbate: "wills-and-administration-of-estates",
    SolicitorsAccounts: "solicitors-accounts",
    LandLaw: "land-law",
    Trusts: "trusts",
    CriminalPractice: "criminal-law-and-practice",
  };

  const mapped = canonicalToLegacy[canonical];
  if (!mapped) return null;

  return TOPIC_KEY_TO_NAME[mapped] ?? null;
}

/**
 * Returns a canonical TopicName if the input matches a known topic name (or alias).
 */
export function canonicalTopicName(name: string): TopicName | null {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const aliased = (NAME_ALIASES_TO_CANONICAL[trimmed] ?? trimmed) as TopicName;
  return SUBTOPICS_BY_TOPIC_NAME[aliased] ? aliased : null;
}

/**
 * Main helper used by learn/[key]/page.tsx:
 * `subtopicsForTopicKey(topic.key)`
 */
export function subtopicsForTopicKey(key: string): readonly string[] {
  const name = topicNameForKey(key);
  if (!name) return [];
  return SUBTOPICS_BY_TOPIC_NAME[name] ?? [];
}

/**
 * If you ever need it by topic title/module name.
 */
export function subtopicsForTopicName(name: string): readonly string[] {
  const canonical = canonicalTopicName(name);
  if (!canonical) return [];
  return SUBTOPICS_BY_TOPIC_NAME[canonical] ?? [];
}

/**
 * Main validator used by learn/[key]/page.tsx to keep querystring safe:
 * `isValidSubtopic(topic.key, subtopic)`
 */
export function isValidSubtopic(topicKey: string, subtopic: string): boolean {
  const list = subtopicsForTopicKey(topicKey);
  if (!list.length) return false;

  const target = normalize(subtopic);
  return list.some((s) => normalize(s) === target);
}

/**
 * Optional convenience exports (useful for building a library page / filters later).
 */
export const ALL_TOPIC_KEYS: readonly TopicKey[] = Object.keys(
  TOPIC_KEY_TO_NAME,
) as TopicKey[];

export const ALL_SUBTOPICS_BY_TOPIC_KEY: Record<TopicKey, readonly string[]> =
  ALL_TOPIC_KEYS.reduce((acc, k) => {
    acc[k] = subtopicsForTopicKey(k);
    return acc;
  }, {} as Record<TopicKey, readonly string[]>);
