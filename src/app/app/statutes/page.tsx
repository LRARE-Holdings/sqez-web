// src/app/app/statutes/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Search, Filter, BookOpen, ExternalLink } from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { allTopics } from "@/lib/topicCatalog";
import {
  subtopicsForTopicKey,
  topicNameForKey,
  type TopicKey,
} from "@/lib/catalog/subtopics";

type Statute = {
  id: string;
  title: string;
  year?: number;
  short?: string;
  url?: string; // e.g. legislation.gov.uk
  // Linkage
  topicKeys: TopicKey[];
  subtopics?: string[]; // must align with subtopicsForTopicKey for those topics
  tags?: string[];
  priority?: "core" | "useful";
};

// ✅ Skeleton seed data (replace with your canonical library later)
const STATUTES: Statute[] = [
  {
    id: "lra-2002",
    title: "Land Registration Act",
    year: 2002,
    short: "Registration, priority, notices/restrictions, overriding interests (headline).",
    url: "https://www.legislation.gov.uk/ukpga/2002/9/contents",
    topicKeys: ["land-law", "property-practice"],
    subtopics: ["Registration (LRA 2002)", "Title & Restrictions"],
    priority: "core",
  },
  {
    id: "lpa-1925",
    title: "Law of Property Act",
    year: 1925,
    short: "Conveyancing framework: legal estates/interests, formalities, co-ownership.",
    url: "https://www.legislation.gov.uk/ukpga/Geo5/15-16/20/contents",
    topicKeys: ["land-law", "property-practice"],
    subtopics: ["Estates & Interests", "Co-ownership"],
    priority: "core",
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
  },
];

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

function topicLabelForKey(k: string) {
  // Prefer your existing topic catalog titles where possible
  const fromCatalog = allTopics.find((t) => t.key === k)?.title;
  return fromCatalog ?? topicNameForKey(k) ?? k;
}

export default function StatutesPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [topicKey, setTopicKey] = useState<string>(sp.get("topic") ?? "ALL");
  const [subtopic, setSubtopic] = useState<string>(sp.get("subtopic") ?? "ALL");
  const [priority, setPriority] = useState<"ALL" | "core" | "useful">(
    (sp.get("priority") as any) ?? "ALL",
  );

  const topicOptions = useMemo(() => {
    // Use allTopics so it matches /learn keys
    return allTopics
      .map((t) => ({ key: t.key, label: t.title }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const subtopicOptions = useMemo(() => {
    if (topicKey === "ALL") return [];
    return subtopicsForTopicKey(topicKey).slice().sort((a, b) => a.localeCompare(b));
  }, [topicKey]);

  const filtered = useMemo(() => {
    const nq = normalize(q);

    return STATUTES.filter((s) => {
      if (priority !== "ALL" && s.priority !== priority) return false;

      if (topicKey !== "ALL" && !s.topicKeys.includes(topicKey as TopicKey)) return false;

      if (subtopic !== "ALL") {
        const list = (s.subtopics ?? []).map(normalize);
        if (!list.includes(normalize(subtopic))) return false;
      }

      if (!nq) return true;

      const hay = [
        s.title,
        s.short ?? "",
        String(s.year ?? ""),
        ...(s.tags ?? []),
        ...s.topicKeys.map(topicLabelForKey),
        ...(s.subtopics ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(nq);
    }).sort((a, b) => {
      // core first, then alpha
      const pa = a.priority === "core" ? 0 : 1;
      const pb = b.priority === "core" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
  }, [q, topicKey, subtopic, priority]);

  function updateUrl(next: {
    q?: string;
    topic?: string;
    subtopic?: string;
    priority?: string;
  }) {
    const params = new URLSearchParams();

    const nq = (next.q ?? q).trim();
    const nt = next.topic ?? topicKey;
    const ns = next.subtopic ?? subtopic;
    const np = next.priority ?? priority;

    if (nq) params.set("q", nq);
    if (nt && nt !== "ALL") params.set("topic", nt);
    if (ns && ns !== "ALL") params.set("subtopic", ns);
    if (np && np !== "ALL") params.set("priority", np);

    router.replace(`/app/statutes${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight text-white">Statute library</div>
          <div className="mt-1 text-sm text-white/70">
            Filter by topic and subtopic. Later we’ll surface these inside each Learn topic.
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/app/learn" className="btn btn-ghost !no-underline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Learn
          </Link>
        </div>
      </div>

      <AppCard title="Find statutes" subtitle="Search + filter. (Skeleton — add your full catalogue next.)">
        <div className="grid gap-4">
          {/* Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                className="input w-full pl-10"
                placeholder="Search: name, year, topic, subtopic…"
                value={q}
                onChange={(e) => {
                  const v = e.target.value;
                  setQ(v);
                  updateUrl({ q: v });
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setQ("");
                setTopicKey("ALL");
                setSubtopic("ALL");
                setPriority("ALL");
                router.replace("/app/statutes");
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear
            </button>
          </div>

          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            <AppCardSoft className="px-5 py-4">
              <div className="text-xs text-white/60">Topic</div>
              <select
                className="input mt-2"
                value={topicKey}
                onChange={(e) => {
                  const v = e.target.value;
                  setTopicKey(v);
                  // Reset subtopic when topic changes
                  setSubtopic("ALL");
                  updateUrl({ topic: v, subtopic: "ALL" });
                }}
              >
                <option value="ALL">All topics</option>
                {topicOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </AppCardSoft>

            <AppCardSoft className="px-5 py-4">
              <div className="text-xs text-white/60">Subtopic</div>
              <select
                className="input mt-2"
                value={subtopic}
                onChange={(e) => {
                  const v = e.target.value;
                  setSubtopic(v);
                  updateUrl({ subtopic: v });
                }}
                disabled={topicKey === "ALL"}
              >
                <option value="ALL">
                  {topicKey === "ALL" ? "Select a topic first" : "All subtopics"}
                </option>
                {subtopicOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </AppCardSoft>

            <AppCardSoft className="px-5 py-4">
              <div className="text-xs text-white/60">Importance</div>
              <select
                className="input mt-2"
                value={priority}
                onChange={(e) => {
                  const v = e.target.value as "ALL" | "core" | "useful";
                  setPriority(v);
                  updateUrl({ priority: v });
                }}
              >
                <option value="ALL">All</option>
                <option value="core">Core</option>
                <option value="useful">Useful</option>
              </select>
            </AppCardSoft>
          </div>

          {/* Results */}
          <div className="mt-2 grid gap-3">
            <div className="text-xs text-white/55">
              Showing <span className="text-white/80">{filtered.length}</span> items
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
                No statutes match your filters.
              </div>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id}
                  className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-white">
                          {s.title}
                          {s.year ? ` ${s.year}` : ""}
                        </div>
                        {s.priority ? (
                          <span className="chip">
                            {s.priority === "core" ? "Core" : "Useful"}
                          </span>
                        ) : null}
                      </div>

                      {s.short ? (
                        <div className="mt-2 text-sm text-white/70">{s.short}</div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.topicKeys.map((k) => (
                          <span key={k} className="chip">
                            <BookOpen className="mr-1 h-3.5 w-3.5 text-white/60" />
                            {topicLabelForKey(k)}
                          </span>
                        ))}
                        {(s.subtopics ?? []).slice(0, 6).map((st) => (
                          <span key={st} className="chip">
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {s.url ? (
                        <a
                          className="btn btn-outline !no-underline"
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      ) : null}
                      {/* Placeholder for future: open topic-specific view */}
                      <button type="button" className="btn btn-ghost" disabled>
                        Add to topic
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </AppCard>
    </div>
  );
}