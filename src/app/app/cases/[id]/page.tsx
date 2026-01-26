"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Gavel,
  Library,
  Tag,
  Sparkles,
  BookOpen,
  ChevronRight,
} from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey } from "@/lib/catalog/subtopics";

type CaseDoc = {
  id: string;
  name: string;
  citation?: string;
  court?: string;
  year?: string;

  // mapping
  topicKeys: string[];
  subtopics?: string[];

  // content
  summary: string;
  rule?: string; // ratio / principle
  whyItMatters?: string;
  examAngle?: string;
  keyFacts?: string[];
  tags?: string[];
  relatedCaseIds?: string[];
};

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function resolveTopicTitle(topicKey: string): string {
  const t = allTopics.find((x) => x.key === topicKey);
  return t?.title ?? topicKey;
}

/**
 * ✅ TEMP seed data
 * Replace this lookup with Firestore in the next step.
 */
const CASES_BY_ID: Record<string, CaseDoc> = {
  "donoghue-v-stevenson": {
    id: "donoghue-v-stevenson",
    name: "Donoghue v Stevenson",
    citation: "[1932] AC 562",
    court: "HL",
    year: "1932",
    topicKeys: ["tort-law"],
    subtopics: ["Duty & Standard", "Causation & Remoteness"],
    summary:
      "Established the modern duty of care in negligence (neighbour principle) and the foundation of product liability in negligence.",
    rule:
      "A duty of care is owed to those who are so closely and directly affected by an act that they ought reasonably to be in contemplation as likely to be affected.",
    whyItMatters:
      "It’s the starting point for duty of care analysis. You’ll use it constantly in negligence questions, especially where the claimant and defendant have no contract.",
    examAngle:
      "Use as authority for (1) recognising a duty of care, and (2) framing the ‘neighbour principle’ before moving to modern tests where relevant.",
    keyFacts: [
      "Claimant drank ginger beer from an opaque bottle.",
      "A decomposed snail was allegedly found inside.",
      "No contract between claimant and manufacturer.",
    ],
    tags: ["negligence", "duty", "product liability"],
    relatedCaseIds: ["caparo-v-dickman"],
  },

  "carlill-v-carbolic-smoke-ball": {
    id: "carlill-v-carbolic-smoke-ball",
    name: "Carlill v Carbolic Smoke Ball Co",
    citation: "[1893] 1 QB 256",
    court: "CA",
    year: "1893",
    topicKeys: ["contract-law"],
    subtopics: ["Offer & Acceptance", "Intention & Formalities"],
    summary:
      "A unilateral offer can be accepted by performance; adverts can constitute offers where intention is clear.",
    rule:
      "A promise can be binding when made to the world at large if it shows clear intention to be bound and is accepted by performing the stated conditions.",
    whyItMatters:
      "Core authority for unilateral offers and acceptance by conduct—useful for offer/acceptance and intention problems.",
    examAngle:
      "Use to argue an advert is an offer (not merely invitation to treat) when terms are definite and the promisor indicates seriousness (e.g. deposit).",
    keyFacts: [
      "Company advertised £100 reward if users caught influenza after using product as directed.",
      "Stated it had deposited money to show sincerity.",
      "Claimant used product and still became ill.",
    ],
    tags: ["offer", "acceptance", "intention"],
  },
};

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  const [rawId, setRawId] = useState("");

  // Resolve params.id safely (Next 16 async params)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await params;
      if (cancelled) return;
      setRawId((p?.id ?? "").trim());
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const caseId = useMemo(() => safeDecode(rawId).trim(), [rawId]);

  const doc = useMemo<CaseDoc | null>(() => {
    if (!caseId) return null;
    return CASES_BY_ID[caseId] ?? null;
  }, [caseId]);

  const primaryTopicKey = doc?.topicKeys?.[0] ?? null;

  const validSubtopics = useMemo(() => {
    if (!primaryTopicKey) return [];
    return [...subtopicsForTopicKey(primaryTopicKey)];
  }, [primaryTopicKey]);

  const shownSubtopics = useMemo(() => {
    if (!doc?.subtopics?.length) return [];
    // prune to canonical list if we can
    if (validSubtopics.length === 0) return doc.subtopics;
    return doc.subtopics.filter((s) => validSubtopics.includes(s));
  }, [doc, validSubtopics]);

  if (!caseId) {
    return (
      <div className="grid gap-6">
        <AppCard title="Case not found" subtitle="Missing case id.">
          <Link href="/app/cases" className="btn btn-primary !no-underline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to cases
          </Link>
        </AppCard>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="grid gap-6">
        <AppCard title="Case not found" subtitle="Try again from the cases library.">
          <div className="mt-2 text-sm text-white/70">
            Unknown case id: <span className="text-white/90">{caseId}</span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/app/cases" className="btn btn-primary !no-underline">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to cases
            </Link>

            <Link href="/app/learn" className="btn btn-outline !no-underline">
              Browse topics
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs text-white/60">
            <Gavel className="h-4 w-4 text-white/45" />
            <span>Case brief</span>
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {doc.name}
          </div>

          <div className="mt-2 text-sm text-white/70">
            {doc.citation ? <span className="text-white/80">{doc.citation}</span> : null}
            {doc.court || doc.year ? (
              <span className="text-white/50">
                {" "}
                • {[doc.court, doc.year].filter(Boolean).join(" ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link href="/app/cases" className="btn btn-ghost !no-underline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>

          {primaryTopicKey ? (
            <Link
              href={`/app/learn/${encodeURIComponent(primaryTopicKey)}`}
              className="btn btn-outline !no-underline"
            >
              Open topic
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Top row: Summary + Mapping */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AppCard title="Summary" subtitle="The fastest way to recall the point of the case.">
            <div className="mt-2 text-sm leading-relaxed text-white/75">
              {doc.summary}
            </div>

            {doc.tags && doc.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {doc.tags.slice(0, 10).map((t) => (
                  <span key={t} className="chip">
                    <Tag className="mr-2 h-3.5 w-3.5 text-white/55" />
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </AppCard>
        </div>

        <div className="lg:col-span-4">
          <AppCard title="Where this fits" subtitle="Mapped so you can filter and drill.">
            <div className="mt-2 grid gap-3">
              <AppCardSoft className="px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Library className="h-4 w-4 text-white/45" />
                  <span>Topics</span>
                </div>

                <div className="mt-2 grid gap-2">
                  {doc.topicKeys.map((k) => (
                    <Link
                      key={k}
                      href={`/app/learn/${encodeURIComponent(k)}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/10"
                    >
                      {resolveTopicTitle(k)}
                    </Link>
                  ))}
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <BookOpen className="h-4 w-4 text-white/45" />
                  <span>Subtopics</span>
                </div>

                {shownSubtopics.length === 0 ? (
                  <div className="mt-2 text-sm text-white/65">
                    No subtopics mapped yet.
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {shownSubtopics.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </AppCardSoft>
            </div>
          </AppCard>
        </div>
      </div>

      {/* Rule / Exam angle */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <AppCard
            title="Rule / principle"
            subtitle="What you cite. Keep this crisp."
          >
            <div className="mt-2 text-sm leading-relaxed text-white/75">
              {doc.rule ?? "Not added yet."}
            </div>
          </AppCard>
        </div>

        <div className="lg:col-span-6">
          <AppCard
            title="Exam angle"
            subtitle="How this shows up in MCQs and scenarios."
          >
            <div className="mt-2 text-sm leading-relaxed text-white/75">
              {doc.examAngle ?? "Not added yet."}
            </div>
          </AppCard>
        </div>
      </div>

      {/* Key facts + Why it matters */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <AppCard title="Key facts" subtitle="The minimum you need to remember.">
            {doc.keyFacts && doc.keyFacts.length > 0 ? (
              <ul className="mt-2 grid gap-2 text-sm text-white/75">
                {doc.keyFacts.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-white/65">Not added yet.</div>
            )}
          </AppCard>
        </div>

        <div className="lg:col-span-6">
          <AppCard title="Why it matters" subtitle="The practical takeaway.">
            <div className="mt-2 text-sm leading-relaxed text-white/75">
              {doc.whyItMatters ?? "Not added yet."}
            </div>
          </AppCard>
        </div>
      </div>

      {/* Placeholder for next: related / drill */}
      <AppCard
        title="Next step"
        subtitle="We’ll wire this to Firestore and add drill actions."
      >
        <div className="mt-2 flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2">
            <Sparkles className="h-4 w-4 text-white/70" />
          </div>
          <div className="text-sm text-white/70">
            Next we’ll define the Firestore schema and replace the in-file case map with a real collection.
            Then we can add “Start a session filtered to this case’s subtopics”.
          </div>
        </div>
      </AppCard>
    </div>
  );
}