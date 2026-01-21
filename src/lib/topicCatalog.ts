export type Topic = {
  module: "FLK1" | "FLK2";
  title: string;
  symbol: string; // kept for parity with Swift (SF Symbols), not used directly on web
  overview: string;
  jsonKey: string;
  fileName: string; // canonical: "FLK1_DisputeResolution.json"
};

function withFileName(t: Omit<Topic, "fileName">): Topic {
  return { ...t, fileName: `${t.module}_${t.jsonKey}.json` };
}

// MARK: FLK1 (order per syllabus convention)
export const flk1: Topic[] = [
  withFileName({
    module: "FLK1",
    title: "Business Law and Practice",
    symbol: "briefcase.fill",
    overview:
      "Company structures, directors’ duties, share capital and transactions, debt and security, meetings, members’ remedies, and core practitioner procedures.",
    jsonKey: "BusinessLawandPractice",
  }),
  withFileName({
    module: "FLK1",
    title: "Dispute Resolution",
    symbol: "doc.text.magnifyingglass",
    overview:
      "Civil litigation framework: CPR principles, commencement/service, statements of case, interim applications, case management, disclosure/evidence, settlement, costs, and enforcement.",
    jsonKey: "DisputeResolution",
  }),
  withFileName({
    module: "FLK1",
    title: "Contract Law",
    symbol: "doc.text",
    overview:
      "Formation, consideration, terms and interpretation, misrepresentation, unfair terms, breach and remedies, frustration and privity.",
    jsonKey: "Contract",
  }),
  withFileName({
    module: "FLK1",
    title: "Tort Law",
    symbol: "exclamationmark.triangle.fill",
    overview:
      "Negligence (duty/standard/breach/causation/remoteness), defences and remedies; occupiers’ liability, nuisance, vicarious liability, negligent misstatement.",
    jsonKey: "Tort",
  }),
  withFileName({
    module: "FLK1",
    title: "The Legal System of England & Wales",
    symbol: "building.columns",
    overview:
      "Courts and tribunals, sources of law, precednet, standards of proof, ADR, professional conduct and access to justice.",
    jsonKey: "LegalSystemofEnglandandWales",
  }),
  withFileName({
    module: "FLK1",
    title: "Constitutional & Administrative",
    symbol: "globe",
    overview:
      "Separation of powers, judicial review, human rights, retained EU law, devolution, and regulation of legal services.",
    jsonKey: "ConstitutionalAdministrativeEULegalServices",
  }),
];

// MARK: FLK2
export const flk2: Topic[] = [
  withFileName({
    module: "FLK2",
    title: "Property Practice",
    symbol: "house.fill",
    overview:
      "Conveyancing: due diligence/searches, contracts/exchange, pre-completion, completion mechanics and registration.",
    jsonKey: "PropertyPractice",
  }),
  withFileName({
    module: "FLK2",
    title: "Wills & Administration of Estates",
    symbol: "person.crop.circle.badge.checkmark",
    overview:
      "Will formalities and capacity, grants of representation, intestacy, PR duties, family provision and estate administration.",
    jsonKey: "WillsAndProbate",
  }),
  withFileName({
    module: "FLK2",
    title: "Solicitors’ Accounts",
    symbol: "banknote",
    overview:
      "SRA Accounts Rules: client vs office money, receipts/payments, transfers, residual balances, interest policy, reconciliations and reporting.",
    jsonKey: "SolicitorsAccounts",
  }),
  withFileName({
    module: "FLK2",
    title: "Land Law",
    symbol: "map.fill",
    overview:
      "Estates and interests, registration, overriding interests, easements, covenants, co-ownership, adverse possession and proprietary estoppel.",
    jsonKey: "LandLaw",
  }),
  withFileName({
    module: "FLK2",
    title: "Trusts",
    symbol: "person.3.fill",
    overview:
      "Three certainties, constitution, trustees’ duties and powers, breach and remedies, resulting/constructive trusts, tracing.",
    jsonKey: "Trusts",
  }),
  withFileName({
    module: "FLK2",
    title: "Criminal Practice",
    symbol: "shield.fill",
    overview:
      "Actus reus/mens rea, offences against the person/property, inchoate liability, procedure, defences and sentencing overview.",
    jsonKey: "CriminalPractice",
  }),
];

// Combined list
export const allTopics: Topic[] = [...flk1, ...flk2];

// Lookups (mirror Swift helpers)

export function byTitle(title: string): Topic | undefined {
  const target = title.trim().toLowerCase();
  return allTopics.find((t) => t.title.trim().toLowerCase() === target);
}

export function moduleForTitle(title: string): "FLK1" | "FLK2" | "" {
  return byTitle(title)?.module ?? "";
}

export function fileNameForTitle(title: string): string | undefined {
  return byTitle(title)?.fileName;
}

export function overviewForTitle(title: string): string {
  return byTitle(title)?.overview ?? "";
}

export function symbolForTitle(title: string): string {
  return byTitle(title)?.symbol ?? "doc.text";
}

export function byJsonKey(jsonKey: string): Topic | undefined {
  const key = jsonKey.trim().toLowerCase();
  return allTopics.find((t) => t.jsonKey.trim().toLowerCase() === key);
}