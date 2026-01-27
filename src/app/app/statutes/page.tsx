// src/app/app/statutes/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Filter, Search, ChevronRight, X, ExternalLink, Scale } from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey } from "@/lib/catalog/subtopics";

type Statute = {
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

/**
 * ✅ Seed data (placeholder)
 * Replace with Firestore later (e.g. /statuteLibrary collection)
 */
const STATUTES: Statute[] = [
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

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function topicTitle(key: string) {
  const t = allTopics.find((x) => x.key === key);
  return t?.title ?? key;
}

export default function StatutesPage() {
  const [query, setQuery] = useState("");
  const [topicKey, setTopicKey] = useState<string>("ALL");
  const [subtopic, setSubtopic] = useState<string>("ALL");
  const [importance, setImportance] = useState<"ALL" | "core" | "useful">("ALL");

  const topicOptions = useMemo(() => {
    const uniq = Array.from(new Map(allTopics.map((t) => [t.key, t])).values());
    return uniq.sort((a, b) => a.title.localeCompare(b.title));
  }, []);

  const subtopicOptions = useMemo(() => {
    if (!topicKey || topicKey === "ALL") return [];
    return [...subtopicsForTopicKey(topicKey)].sort((a, b) => a.localeCompare(b));
  }, [topicKey]);

  const filtered = useMemo(() => {
    const q = norm(query);

    return STATUTES.filter((s) => {
      // Importance filter
      if (importance !== "ALL" && s.priority !== importance) return false;

      // Topic filter
      if (topicKey !== "ALL" && !s.topicKeys.includes(topicKey)) return false;

      // Subtopic filter
      if (subtopic !== "ALL") {
        const subs = s.subtopics ?? [];
        if (!subs.includes(subtopic)) return false;
      }

      // Search
      if (!q) return true;
      const hay = [
        s.title,
        String(s.year ?? ""),
        s.short ?? "",
        ...(s.tags ?? []),
        ...(s.subtopics ?? []),
        ...(s.topicKeys ?? []).map(topicTitle),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    }).sort((a, b) => {
      // core first, then alphabetical
      const pa = a.priority === "core" ? 0 : 1;
      const pb = b.priority === "core" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
  }, [query, topicKey, subtopic, importance]);

  const hasActiveFilters =
    topicKey !== "ALL" ||
    subtopic !== "ALL" ||
    importance !== "ALL" ||
    query.trim().length > 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight text-white">
            Statute library
          </div>
          <div className="mt-1 text-sm text-white/70">
            Find the statutes you need, mapped to topics and subtopics.
          </div>
        </div>
      </div>

      <AppCard
        title="Statutes"
        subtitle="Search + filter. Later we’ll surface these inside each Learn topic (and wire to Firestore)."
      >
        {/* Filters */}
        <div className="mt-2 grid gap-3">
          <div className="grid gap-3 xl:grid-cols-[1fr_220px_260px_200px]">
            {/* Search */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Search className="h-4 w-4 text-white/45" />
                <span>Search statutes</span>
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
                placeholder="e.g. LRA 2002, capacity, registration, priority…"
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

            {/* Importance */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Scale className="h-4 w-4 text-white/45" />
                <span>Importance</span>
              </div>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
                value={importance}
                onChange={(e) => setImportance(e.target.value as any)}
              >
                <option value="ALL">All</option>
                <option value="core">Core</option>
                <option value="useful">Useful</option>
              </select>
            </div>
          </div>

          {/* Filter strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-white/60">
              Showing <span className="text-white/85">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "statute" : "statutes"}
              {topicKey !== "ALL" ? (
                <>
                  {" "}
                  for <span className="text-white/85">{topicTitle(topicKey)}</span>
                </>
              ) : null}
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-2 no-underline!"
                onClick={() => {
                  setQuery("");
                  setTopicKey("ALL");
                  setSubtopic("ALL");
                  setImportance("ALL");
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
                <BookOpen className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  No statutes found
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Try clearing filters, or search by name (e.g. “Land Registration Act”).
                </div>
                <div className="mt-3">
                  <Link href="/app/learn" className="btn btn-outline no-underline!">
                    Browse topics
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </AppCardSoft>
        ) : (
          filtered.map((s) => (
            <AppCardSoft key={s.id} className="px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-white">
                      {s.title}
                      {s.year ? ` ${s.year}` : ""}
                    </div>
                    {s.priority ? (
                      <span className="chip">{s.priority === "core" ? "Core" : "Useful"}</span>
                    ) : null}
                  </div>

                  {s.short ? (
                    <div className="mt-3 text-sm leading-relaxed text-white/70">
                      {s.short}
                    </div>
                  ) : null}

                  {(s.subtopics && s.subtopics.length > 0) || (s.topicKeys && s.topicKeys.length > 0) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(s.subtopics ?? []).slice(0, 6).map((st) => (
                        <span key={st} className="chip">
                          {st}
                        </span>
                      ))}
                      {(s.subtopics?.length ?? 0) > 6 ? (
                        <span className="chip">+{(s.subtopics?.length ?? 0) - 6}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col gap-2 sm:items-end">
                  {s.url ? (
                    <a
                      className="btn btn-outline w-full sm:w-auto no-underline!"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open legislation
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-ghost w-full sm:w-auto"
                    onClick={() => {
                      const firstTopic = s.topicKeys?.[0];
                      if (firstTopic) window.location.assign(`/app/learn/${firstTopic}`);
                    }}
                    disabled={!s.topicKeys || s.topicKeys.length === 0}
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
        Next: wire this to a Firestore-backed <code className="px-1">statuteLibrary</code>{" "}
        collection and add a dedicated statute detail page.
      </div>
    </div>
  );
}