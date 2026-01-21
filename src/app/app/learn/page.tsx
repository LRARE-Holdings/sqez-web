"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppCard } from "@/components/ui/AppCard";
import { allTopics, type Topic } from "@/lib/topicCatalog";

type ModuleFilter = "ALL" | "FLK1" | "FLK2";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/7",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TopicRow({ t }: { t: Topic }) {
  return (
    <Link
      href={`/app/learn/${encodeURIComponent(t.jsonKey)}`}
      className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/7"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{t.title}</div>
          <div className="mt-1 text-xs text-white/60">{t.module}</div>
        </div>

        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Covered
        </span>
      </div>

      <div className="mt-3 text-sm leading-relaxed text-white/80">
        {t.overview}
      </div>

      <div className="mt-3 text-xs text-white/60">
        JSON: <span className="text-white/70">{t.fileName}</span>
      </div>
    </Link>
  );
}

export default function LearnPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModuleFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      filter === "ALL"
        ? allTopics
        : allTopics.filter((t) => t.module === filter);

    if (!q) return base;

    return base.filter((t) => {
      const hay =
        `${t.title} ${t.overview} ${t.jsonKey} ${t.module}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, filter]);

  const flk1List = useMemo(
    () => filtered.filter((t) => t.module === "FLK1"),
    [filtered],
  );
  const flk2List = useMemo(
    () => filtered.filter((t) => t.module === "FLK2"),
    [filtered],
  );

  return (
    <div className="grid gap-6">
      <AppCard
        title="Learn"
        subtitle="All topics covered by SQEz. Pick a topic to drill down."
        right={<span className="chip">{filtered.length} topics</span>}
      >
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <label
              className="block text-xs font-medium text-white/75"
              htmlFor="topicSearch"
            >
              Search topics
            </label>
            <input
              id="topicSearch"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="e.g. Contract, CPR, Land registration…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-2 text-xs text-white/60">
              Web-native index of the syllabus coverage.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs text-white/60">Module filter</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
                All
              </Chip>
              <Chip active={filter === "FLK1"} onClick={() => setFilter("FLK1")}>
                FLK1
              </Chip>
              <Chip active={filter === "FLK2"} onClick={() => setFilter("FLK2")}>
                FLK2
              </Chip>
            </div>

            <div className="mt-4 text-xs text-white/60">Quick jump</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Link href="/app/session" className="btn btn-outline w-full sm:w-auto">
                Quickfire
              </Link>
              <Link href="/app/revise" className="btn btn-ghost w-full sm:w-auto">
                Revise
              </Link>
            </div>
          </div>
        </div>
      </AppCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-3">
          <div className="flex items-end justify-between">
            <div className="text-sm font-semibold text-white">FLK1</div>
            <div className="text-xs text-white/60">{flk1List.length} topics</div>
          </div>

          <div className="grid gap-3">
            {(filter === "FLK2" ? [] : flk1List).map((t) => (
              <TopicRow key={t.jsonKey} t={t} />
            ))}
            {filter !== "FLK2" && flk1List.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                No FLK1 topics match your search.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-end justify-between">
            <div className="text-sm font-semibold text-white">FLK2</div>
            <div className="text-xs text-white/60">{flk2List.length} topics</div>
          </div>

          <div className="grid gap-3">
            {(filter === "FLK1" ? [] : flk2List).map((t) => (
              <TopicRow key={t.jsonKey} t={t} />
            ))}
            {filter !== "FLK1" && flk2List.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                No FLK2 topics match your search.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}