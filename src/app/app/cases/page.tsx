"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Filter, Search, ChevronRight, X, Gavel } from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey } from "@/lib/catalog/subtopics";

type CaseItem = {
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

/**
 * ✅ Seed data (placeholder)
 * Replace with Firestore later (e.g. /caseLibrary collection)
 */
const CASES: CaseItem[] = [
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

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function CasesPage() {
  const [query, setQuery] = useState("");
  const [topicKey, setTopicKey] = useState<string>("ALL");
  const [subtopic, setSubtopic] = useState<string>("ALL");

  const topicOptions = useMemo(() => {
    // Your allTopics keys are canonical for routing; use them for selection.
    const uniq = Array.from(
      new Map(allTopics.map((t) => [t.key, t])).values(),
    );
    return uniq.sort((a, b) => a.title.localeCompare(b.title));
  }, []);

  const subtopicOptions = useMemo(() => {
    if (!topicKey || topicKey === "ALL") return [];
    return [...subtopicsForTopicKey(topicKey)];
  }, [topicKey]);

  const filtered = useMemo(() => {
    const q = norm(query);

    return CASES.filter((c) => {
      // Topic filter
      if (topicKey !== "ALL" && !c.topicKeys.includes(topicKey)) return false;

      // Subtopic filter
      if (subtopic !== "ALL") {
        const subs = c.subtopics ?? [];
        if (!subs.includes(subtopic)) return false;
      }

      // Search
      if (!q) return true;
      const hay = [
        c.name,
        c.citation ?? "",
        c.summary,
        ...(c.tags ?? []),
        ...(c.subtopics ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [query, topicKey, subtopic]);

  const hasActiveFilters = topicKey !== "ALL" || subtopic !== "ALL" || query.trim().length > 0;

  return (
    <div className="grid gap-6">
      <AppCard
        title="Case library"
        subtitle="Key cases, mapped to topics and subtopics. Use this to revise fast — then drill with sessions."
      >
        {/* Filters */}
        <div className="mt-2 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_260px]">
            {/* Search */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Search className="h-4 w-4 text-white/45" />
                <span>Search cases</span>
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
                placeholder="e.g. duty of care, [1932] AC 562, negligence…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Topic */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Filter className="h-4 w-4 text-white/45" />
                <span>Topic</span>
              </div>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
                value={topicKey}
                onChange={(e) => {
                  const next = e.target.value;
                  setTopicKey(next);
                  setSubtopic("ALL"); // reset when topic changes
                }}
              >
                <option value="ALL">All topics</option>
                {topicOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtopic */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <BookOpen className="h-4 w-4 text-white/45" />
                <span>Subtopic</span>
              </div>

              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 disabled:opacity-60"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                disabled={topicKey === "ALL" || subtopicOptions.length === 0}
              >
                <option value="ALL">
                  {topicKey === "ALL" ? "Choose a topic first" : "All subtopics"}
                </option>
                {subtopicOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {topicKey !== "ALL" && subtopicOptions.length === 0 ? (
                <div className="mt-2 text-xs text-white/55">
                  No subtopics found for this topic (check your catalog mapping).
                </div>
              ) : null}
            </div>
          </div>

          {/* Filter strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-white/60">
              Showing <span className="text-white/85">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "case" : "cases"}
              {topicKey !== "ALL" ? (
                <>
                  {" "}
                  for <span className="text-white/85">{topicKey}</span>
                </>
              ) : null}
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-2 !no-underline"
                onClick={() => {
                  setQuery("");
                  setTopicKey("ALL");
                  setSubtopic("ALL");
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </AppCard>

      {/* Results */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <AppCardSoft className="px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2">
                <Gavel className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  No cases found
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Try clearing filters, or search by a well-known case name.
                </div>
                <div className="mt-3">
                  <Link
                    href="/app/learn"
                    className="btn btn-outline !no-underline"
                  >
                    Browse topics
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </AppCardSoft>
        ) : (
          filtered.map((c) => (
            <AppCardSoft key={c.id} className="px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white">
                    {c.name}
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    {c.citation ? (
                      <span className="text-white/80">{c.citation}</span>
                    ) : null}
                    {c.year || c.court ? (
                      <span className="text-white/50">
                        {" "}
                        • {[c.court, c.year].filter(Boolean).join(" ")}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 text-sm leading-relaxed text-white/70">
                    {c.summary}
                  </div>

                  {c.subtopics && c.subtopics.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.subtopics.slice(0, 6).map((s) => (
                        <span key={s} className="chip">
                          {s}
                        </span>
                      ))}
                      {c.subtopics.length > 6 ? (
                        <span className="chip">+{c.subtopics.length - 6}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {/* Placeholder action — later: link to /app/cases/[id] */}
                  <button
                    type="button"
                    className="btn btn-outline w-full sm:w-auto"
                    onClick={() => {
                      // For now: push user to the topic page as a useful next action.
                      const firstTopic = c.topicKeys?.[0];
                      if (firstTopic) window.location.assign(`/app/learn/${firstTopic}`);
                    }}
                  >
                    Open topic
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </AppCardSoft>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="text-xs text-white/55">
        Next: wire this to a Firestore-backed <code className="px-1">caseLibrary</code>{" "}
        collection and add a dedicated case detail page.
      </div>
    </div>
  );
}