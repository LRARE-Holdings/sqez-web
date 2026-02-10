// src/lib/catalog/cases.ts
import { topicKeysMatch } from "@/lib/topicKeys";

export type CaseItem = {
  id: string;
  name: string;
  citation?: string;
  year?: string;
  court?: string;
  summary: string;
  url?: string;
  topicKeys: string[];
  subtopics?: string[];
  tags?: string[];
};

// Seed data (expandable; later move to Firestore)
export const CASES: CaseItem[] = [
  {
    id: "salomon-v-salomon",
    name: "Salomon v A Salomon & Co Ltd",
    citation: "[1897] AC 22",
    year: "1897",
    court: "HL",
    summary:
      "Foundational authority on separate legal personality and limited liability.",
    url: "https://en.wikipedia.org/wiki/Salomon_v_A_Salomon_%26_Co_Ltd",
    topicKeys: ["BusinessLawandPractice"],
    subtopics: ["Company Formation", "Corporate Governance"],
    tags: ["company", "separate legal personality"],
  },
  {
    id: "foss-v-harbottle",
    name: "Foss v Harbottle",
    citation: "(1843) 67 ER 189",
    year: "1843",
    court: "Ch",
    summary:
      "Established the proper claimant rule and majority rule principles in company law.",
    url: "https://en.wikipedia.org/wiki/Foss_v_Harbottle",
    topicKeys: ["BusinessLawandPractice"],
    subtopics: ["Members’ Remedies", "Corporate Governance"],
    tags: ["derivative action", "minority shareholder"],
  },
  {
    id: "howard-smith-v-ampol",
    name: "Howard Smith Ltd v Ampol Petroleum Ltd",
    citation: "[1974] AC 821",
    year: "1974",
    court: "PC",
    summary:
      "Directors must use powers for proper purposes, including share issue powers.",
    url: "https://en.wikipedia.org/wiki/Howard_Smith_Ltd_v_Ampol_Petroleum_Ltd",
    topicKeys: ["BusinessLawandPractice"],
    subtopics: ["Directors’ Duties", "Share Capital & Pre-emption"],
    tags: ["proper purpose", "directors duties"],
  },
  {
    id: "halsey-v-milton-keynes",
    name: "Halsey v Milton Keynes General NHS Trust",
    citation: "[2004] EWCA Civ 576",
    year: "2004",
    court: "CA",
    summary:
      "Leading authority on ADR and costs consequences of refusing mediation.",
    url: "https://en.wikipedia.org/wiki/Halsey_v_Milton_Keynes_General_NHS_Trust",
    topicKeys: ["DisputeResolution"],
    subtopics: ["ADR & Settlement", "Costs & Funding"],
    tags: ["mediation", "costs"],
  },
  {
    id: "denton-v-th-white",
    name: "Denton v TH White Ltd",
    citation: "[2014] EWCA Civ 906",
    year: "2014",
    court: "CA",
    summary:
      "Set the modern three-stage test for relief from sanctions under CPR 3.9.",
    url: "https://en.wikipedia.org/wiki/Denton_v_TH_White",
    topicKeys: ["DisputeResolution"],
    subtopics: ["Case Management & Tracks", "CPR & Overriding Objective"],
    tags: ["relief from sanctions", "civil procedure"],
  },
  {
    id: "mitchell-v-news-group",
    name: "Mitchell v News Group Newspapers Ltd",
    citation: "[2013] EWCA Civ 1537",
    year: "2013",
    court: "CA",
    summary:
      "Key post-Jackson case on procedural default and sanctions before Denton clarified the approach.",
    url: "https://en.wikipedia.org/wiki/Mitchell_v_News_Group_Newspapers_Ltd",
    topicKeys: ["DisputeResolution"],
    subtopics: ["Case Management & Tracks", "Costs & Funding"],
    tags: ["sanctions", "jackson reforms"],
  },
  {
    id: "carlill-v-carbolic-smoke-ball",
    name: "Carlill v Carbolic Smoke Ball Co",
    citation: "[1893] 1 QB 256",
    year: "1893",
    court: "CA",
    summary:
      "Classic authority on unilateral offers and acceptance by performance.",
    url: "https://en.wikipedia.org/wiki/Carlill_v_Carbolic_Smoke_Ball_Co",
    topicKeys: ["Contract"],
    subtopics: ["Offer & Acceptance", "Intention & Formalities"],
    tags: ["offer", "acceptance"],
  },
  {
    id: "entores-v-miles-far-east",
    name: "Entores Ltd v Miles Far East Corporation",
    citation: "[1955] 2 QB 327",
    year: "1955",
    court: "CA",
    summary:
      "Acceptance by instantaneous communication is effective when received.",
    url: "https://en.wikipedia.org/wiki/Entores_Ltd_v_Miles_Far_East_Corporation",
    topicKeys: ["Contract"],
    subtopics: ["Offer & Acceptance"],
    tags: ["instantaneous communication", "acceptance"],
  },
  {
    id: "hadley-v-baxendale",
    name: "Hadley v Baxendale",
    citation: "(1854) 9 Exch 341",
    year: "1854",
    court: "Exch",
    summary:
      "Leading authority on remoteness of damage in contract claims.",
    url: "https://en.wikipedia.org/wiki/Hadley_v_Baxendale",
    topicKeys: ["Contract"],
    subtopics: ["Breach & Remedies"],
    tags: ["damages", "remoteness"],
  },
  {
    id: "hong-kong-fir-v-kawasaki",
    name: "Hong Kong Fir Shipping Co Ltd v Kawasaki Kisen Kaisha Ltd",
    citation: "[1962] 2 QB 26",
    year: "1962",
    court: "CA",
    summary:
      "Introduced innominate terms and consequences-based approach to termination.",
    url: "https://en.wikipedia.org/wiki/Hong_Kong_Fir_Shipping_Co_Ltd_v_Kawasaki_Kisen_Kaisha_Ltd",
    topicKeys: ["Contract"],
    subtopics: ["Terms & Interpretation", "Breach & Remedies"],
    tags: ["innominate terms", "termination"],
  },
  {
    id: "donoghue-v-stevenson",
    name: "Donoghue v Stevenson",
    citation: "[1932] AC 562",
    year: "1932",
    court: "HL",
    summary:
      "Established the modern duty of care in negligence (neighbour principle).",
    url: "https://en.wikipedia.org/wiki/Donoghue_v_Stevenson",
    topicKeys: ["Tort"],
    subtopics: ["Duty & Standard", "Negligent Misstatement"],
    tags: ["negligence", "duty"],
  },
  {
    id: "caparo-v-dickman",
    name: "Caparo Industries plc v Dickman",
    citation: "[1990] 2 AC 605",
    year: "1990",
    court: "HL",
    summary:
      "Clarified incremental duty of care through foreseeability, proximity and fairness.",
    url: "https://en.wikipedia.org/wiki/Caparo_Industries_plc_v_Dickman",
    topicKeys: ["Tort"],
    subtopics: ["Duty & Standard", "Negligent Misstatement"],
    tags: ["duty of care", "proximity"],
  },
  {
    id: "bolam-v-friern-hospital",
    name: "Bolam v Friern Hospital Management Committee",
    citation: "[1957] 1 WLR 582",
    year: "1957",
    court: "QBD",
    summary:
      "Professional negligence standard measured by responsible body of opinion.",
    url: "https://en.wikipedia.org/wiki/Bolam_v_Friern_Hospital_Management_Committee",
    topicKeys: ["Tort"],
    subtopics: ["Duty & Standard"],
    tags: ["medical negligence", "standard of care"],
  },
  {
    id: "rylands-v-fletcher",
    name: "Rylands v Fletcher",
    citation: "(1868) LR 3 HL 330",
    year: "1868",
    court: "HL",
    summary:
      "Established strict liability for escape of dangerous things from land.",
    url: "https://en.wikipedia.org/wiki/Rylands_v_Fletcher",
    topicKeys: ["Tort"],
    subtopics: ["Nuisance & Rylands"],
    tags: ["strict liability", "land"],
  },
  {
    id: "pepper-v-hart",
    name: "Pepper (Inspector of Taxes) v Hart",
    citation: "[1993] AC 593",
    year: "1993",
    court: "HL",
    summary:
      "Permitted use of Hansard in limited statutory interpretation circumstances.",
    url: "https://en.wikipedia.org/wiki/Pepper_v_Hart",
    topicKeys: ["LegalSystemofEnglandandWales"],
    subtopics: ["Sources of Law", "Precedent & Interpretation"],
    tags: ["interpretation", "parliamentary materials"],
  },
  {
    id: "r-v-r-1991",
    name: "R v R",
    citation: "[1992] 1 AC 599",
    year: "1992",
    court: "HL",
    summary:
      "Confirmed marital rape exemption had no place in modern common law.",
    url: "https://en.wikipedia.org/wiki/R_v_R",
    topicKeys: ["LegalSystemofEnglandandWales", "CriminalPractice"],
    subtopics: ["Sources of Law", "Procedure"],
    tags: ["common law development", "criminal"],
  },
  {
    id: "ccsu-v-minister-civil-service",
    name: "Council of Civil Service Unions v Minister for the Civil Service",
    citation: "[1985] AC 374",
    year: "1985",
    court: "HL",
    summary:
      "GCHQ case setting core grounds of judicial review and justiciability principles.",
    url: "https://en.wikipedia.org/wiki/CCSU_v_Minister_for_the_Civil_Service",
    topicKeys: ["ConstitutionalAdministrativeEULegalServices"],
    subtopics: ["Judicial Review Grounds", "Public Bodies & Powers"],
    tags: ["judicial review", "gchq"],
  },
  {
    id: "anisminic-v-foreign-compensation",
    name: "Anisminic Ltd v Foreign Compensation Commission",
    citation: "[1969] 2 AC 147",
    year: "1969",
    court: "HL",
    summary:
      "Dramatically narrowed ouster clauses by broadening jurisdictional error.",
    url: "https://en.wikipedia.org/wiki/Anisminic_Ltd_v_Foreign_Compensation_Commission",
    topicKeys: ["ConstitutionalAdministrativeEULegalServices"],
    subtopics: ["Judicial Review Grounds", "Remedies"],
    tags: ["ouster clause", "administrative law"],
  },
  {
    id: "miller-v-prime-minister",
    name: "R (Miller) v The Prime Minister; Cherry v Advocate General for Scotland",
    citation: "[2019] UKSC 41",
    year: "2019",
    court: "UKSC",
    summary:
      "Held prorogation justiciable and unlawful where it frustrated parliamentary accountability.",
    url: "https://www.supremecourt.uk/cases/uksc-2019-0192.html",
    topicKeys: ["ConstitutionalAdministrativeEULegalServices"],
    subtopics: ["Parliamentary Sovereignty", "Rule of Law"],
    tags: ["constitutional", "prorogation"],
  },
  {
    id: "street-v-mountford",
    name: "Street v Mountford",
    citation: "[1985] AC 809",
    year: "1985",
    court: "HL",
    summary:
      "Distinguished leases from licences by substance over labels.",
    url: "https://en.wikipedia.org/wiki/Street_v_Mountford",
    topicKeys: ["LandLaw", "PropertyPractice"],
    subtopics: ["Leases & Licences", "Contracts & Exchange"],
    tags: ["lease", "licence"],
  },
  {
    id: "williams-glyns-v-boland",
    name: "Williams & Glyn's Bank Ltd v Boland",
    citation: "[1981] AC 487",
    year: "1981",
    court: "HL",
    summary:
      "Actual occupation can create overriding interests binding purchasers/lenders.",
    url: "https://en.wikipedia.org/wiki/Williams_%26_Glyn%27s_Bank_v_Boland",
    topicKeys: ["LandLaw", "PropertyPractice"],
    subtopics: ["Overriding Interests", "Title & Restrictions"],
    tags: ["overriding interests", "actual occupation"],
  },
  {
    id: "midland-bank-v-green",
    name: "Midland Bank Trust Co Ltd v Green",
    citation: "[1981] AC 513",
    year: "1981",
    court: "HL",
    summary:
      "Unregistered land purchaser without notice defeated equitable option despite bad motive.",
    url: "https://en.wikipedia.org/wiki/Midland_Bank_Trust_Co_Ltd_v_Green",
    topicKeys: ["LandLaw"],
    subtopics: ["Registration (LRA 2002)", "Estates & Interests"],
    tags: ["unregistered land", "notice"],
  },
  {
    id: "banks-v-goodfellow",
    name: "Banks v Goodfellow",
    citation: "(1870) LR 5 QB 549",
    year: "1870",
    court: "QB",
    summary:
      "Classic test for testamentary capacity in wills.",
    url: "https://en.wikipedia.org/wiki/Banks_v_Goodfellow",
    topicKeys: ["WillsAndProbate"],
    subtopics: ["Capacity", "Formalities"],
    tags: ["testamentary capacity", "wills"],
  },
  {
    id: "white-v-jones",
    name: "White v Jones",
    citation: "[1995] 2 AC 207",
    year: "1995",
    court: "HL",
    summary:
      "Solicitors may owe duty in negligence to intended beneficiaries in will-drafting contexts.",
    url: "https://en.wikipedia.org/wiki/White_v_Jones",
    topicKeys: ["WillsAndProbate"],
    subtopics: ["PR Duties", "Formalities"],
    tags: ["professional negligence", "wills"],
  },
  {
    id: "twinsectra-v-yardley",
    name: "Twinsectra Ltd v Yardley",
    citation: "[2002] UKHL 12",
    year: "2002",
    court: "HL",
    summary:
      "Important authority on dishonest assistance and treatment of client money under trust structures.",
    url: "https://en.wikipedia.org/wiki/Twinsectra_Ltd_v_Yardley",
    topicKeys: ["SolicitorsAccounts", "Trusts"],
    subtopics: ["Client vs Office Money", "Breach & Remedies"],
    tags: ["dishonest assistance", "trust money"],
  },
  {
    id: "knight-v-knight",
    name: "Knight v Knight",
    citation: "(1840) 49 ER 58",
    year: "1840",
    court: "Ch",
    summary:
      "Source of the three certainties required for an express trust.",
    url: "https://en.wikipedia.org/wiki/Knight_v_Knight",
    topicKeys: ["Trusts"],
    subtopics: ["Three Certainties", "Constitution"],
    tags: ["certainty", "express trusts"],
  },
  {
    id: "paul-v-constance",
    name: "Paul v Constance",
    citation: "[1977] 1 WLR 527",
    year: "1977",
    court: "CA",
    summary:
      "Demonstrated certainty of intention can be inferred from informal words and conduct.",
    url: "https://en.wikipedia.org/wiki/Paul_v_Constance",
    topicKeys: ["Trusts"],
    subtopics: ["Three Certainties", "Constructive Trusts"],
    tags: ["certainty of intention", "informal trust"],
  },
  {
    id: "r-v-woollin",
    name: "R v Woollin",
    citation: "[1999] 1 AC 82",
    year: "1999",
    court: "HL",
    summary:
      "Clarified oblique intent direction in criminal law.",
    url: "https://en.wikipedia.org/wiki/R_v_Woollin",
    topicKeys: ["CriminalPractice"],
    subtopics: ["Elements (AR/MR)", "Offences Against the Person"],
    tags: ["intent", "mens rea"],
  },
  {
    id: "r-v-jogee",
    name: "R v Jogee",
    citation: "[2016] UKSC 8",
    year: "2016",
    court: "UKSC",
    summary:
      "Reset principles of secondary liability and joint enterprise.",
    url: "https://www.supremecourt.uk/cases/uksc-2015-0015.html",
    topicKeys: ["CriminalPractice"],
    subtopics: ["Inchoate Liability", "Elements (AR/MR)"],
    tags: ["joint enterprise", "secondary liability"],
  },
];

export function casesForTopicKey(topicKey: string): CaseItem[] {
  if (!topicKey) return [];
  return CASES.filter((c) =>
    c.topicKeys.some((k) => topicKeysMatch(k, topicKey)),
  ).sort((a, b) => a.name.localeCompare(b.name));
}
