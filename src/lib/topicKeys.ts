import { allTopics } from "@/lib/topicCatalog";

function normalizeLoose(value: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeSlug(value: string): string {
  return normalizeLoose(value)
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCompact(value: string): string {
  return normalizeLoose(value)
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const SLUG_TO_CANONICAL: Record<string, string> = {
  "business-law-and-practice": "BusinessLawandPractice",
  "dispute-resolution": "DisputeResolution",
  "contract-law": "Contract",
  "tort-law": "Tort",
  "legal-system-of-england-and-wales": "LegalSystemofEnglandandWales",
  "constitutional-administrative-eu-legal-services": "ConstitutionalAdministrativeEULegalServices",
  "property-practice": "PropertyPractice",
  "wills-and-administration-of-estates": "WillsAndProbate",
  "solicitors-accounts": "SolicitorsAccounts",
  "land-law": "LandLaw",
  trusts: "Trusts",
  "criminal-law-and-practice": "CriminalPractice",
};

const ALIAS_TO_CANONICAL: Record<string, string> = {
  ...SLUG_TO_CANONICAL,
  "contract law": "Contract",
  "tort law": "Tort",
  "criminal law and practice": "CriminalPractice",
  "criminal practice": "CriminalPractice",
  "wills and administration of estates": "WillsAndProbate",
  "wills & administration of estates": "WillsAndProbate",
  "solicitors accounts": "SolicitorsAccounts",
  "the legal system of england and wales": "LegalSystemofEnglandandWales",
  "the legal system of england & wales": "LegalSystemofEnglandandWales",
  "constitutional and administrative": "ConstitutionalAdministrativeEULegalServices",
  "constitutional & administrative": "ConstitutionalAdministrativeEULegalServices",
};

for (const topic of allTopics) {
  ALIAS_TO_CANONICAL[normalizeLoose(topic.key)] = topic.key;
  ALIAS_TO_CANONICAL[normalizeLoose(topic.title)] = topic.key;
  ALIAS_TO_CANONICAL[normalizeSlug(topic.key)] = topic.key;
  ALIAS_TO_CANONICAL[normalizeSlug(topic.title)] = topic.key;
  ALIAS_TO_CANONICAL[normalizeCompact(topic.key)] = topic.key;
  ALIAS_TO_CANONICAL[normalizeCompact(topic.title)] = topic.key;
}

export function canonicalTopicKey(input?: string | null): string | null {
  if (!input) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const loose = normalizeLoose(raw);
  const compact = normalizeCompact(raw);
  const slug = normalizeSlug(raw);

  return (
    ALIAS_TO_CANONICAL[loose] ??
    ALIAS_TO_CANONICAL[compact] ??
    ALIAS_TO_CANONICAL[slug] ??
    null
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveTopicFromParam(input?: string | null) {
  if (!input) return undefined;
  const raw = String(input).trim();
  if (!raw) return undefined;

  const decoded = safeDecode(raw);
  const key = canonicalTopicKey(raw) ?? canonicalTopicKey(decoded);
  if (!key) return undefined;

  return allTopics.find((topic) => topic.key === key);
}

export function topicKeysMatch(a?: string | null, b?: string | null): boolean {
  const ca = canonicalTopicKey(a);
  const cb = canonicalTopicKey(b);

  if (ca && cb) return ca === cb;
  if (!a || !b) return false;

  return normalizeCompact(String(a)) === normalizeCompact(String(b));
}
