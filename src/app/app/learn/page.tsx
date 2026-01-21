"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppCard } from "@/components/ui/AppCard";
import { allTopics, type Topic } from "@/lib/topicCatalog";
import { getItemMetas } from "@/lib/engineStore";

type ModuleFilter = "ALL" | "FLK1" | "FLK2";

type TopicReadiness = {
  totalItems: number;
  dueNow: number;
  avgStability: number;
  avgDifficulty: number;
  status: "Due" | "Building" | "Stable";
};

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

function StatusPill({ r }: { r?: TopicReadiness }) {
  if (!r || r.totalItems === 0) {
    return (
      <span className="chip">
        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        New
      </span>
    );
  }

  if (r.status === "Due") {
    return (
      <span className="chip">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        Due ({r.dueNow})
      </span>
    );
  }

  if (r.status === "Building") {
    return (
      <span className="chip">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
        Building
      </span>
    );
  }

  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Stable
    </span>
  );
}

/**
 * Engine tagging convention (from session runner):
 * tags = [module, topic, subTopic]
 *
 * Firebase currently stores `topic` as a human string (e.g. "Dispute Resolution").
 * TopicCatalog stores a canonical `key` (e.g. "DisputeResolution") plus `title`.
 *
 * We match item.tags[1] (topic) to Topic.title first, then fall back to key-style matching.
 */
function topicKeyForItem(item: { tags: string[] }): string | null {
  const topicTag = (item.tags?.[1] ?? "").trim();
  if (!topicTag) return null;

  const lower = topicTag.toLowerCase();

  // Prefer exact title match (Firebase topic string)
  const byTitle = allTopics.find((t) => t.title.toLowerCase() === lower);
  if (byTitle) return byTitle.key;

  // Next: match compacted title to key (e.g. "disputeresolution" -> "DisputeResolution")
  const compact = lower.replace(/\s+/g, "");
  const byKey = allTopics.find((t) => t.key.toLowerCase() === compact);
  if (byKey) return byKey.key;

  // Fallback: containment
  const loose = allTopics.find(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.key.toLowerCase().includes(compact),
  );
  return loose?.key ?? null;
}

function buildReadinessMap() {
  const items = getItemMetas();
  const nowMs = Date.now();

  const acc = new Map<
    string,
    { total: number; due: number; stabSum: number; diffSum: number }
  >();

  for (const it of items) {
    const key = topicKeyForItem(it);
    if (!key) continue;

    const prev =
      acc.get(key) ?? { total: 0, due: 0, stabSum: 0, diffSum: 0 };

    const dueNow = new Date(it.dueAt).getTime() <= nowMs ? 1 : 0;

    acc.set(key, {
      total: prev.total + 1,
      due: prev.due + dueNow,
      stabSum: prev.stabSum + (it.state?.stability ?? 0),
      diffSum: prev.diffSum + (it.state?.difficulty ?? 0),
    });
  }

  const out: Record<string, TopicReadiness> = {};

  for (const [key, v] of acc.entries()) {
    const avgStability = v.total ? v.stabSum / v.total : 0;
    const avgDifficulty = v.total ? v.diffSum / v.total : 0;

    let status: TopicReadiness["status"] = "Stable";
    if (v.due > 0) status = "Due";
    else if (avgStability < 3) status = "Building";

    out[key] = {
      totalItems: v.total,
      dueNow: v.due,
      avgStability,
      avgDifficulty,
      status,
    };
  }

  return out;
}

export default function LearnPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModuleFilter>("ALL");
  const [readinessByKey, setReadinessByKey] = useState<
    Record<string, TopicReadiness>
  >({});

  useEffect(() => {
    setReadinessByKey(buildReadinessMap());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      filter === "ALL"
        ? allTopics
        : allTopics.filter((t) => t.module === filter);

    if (!q) return base;

    return base.filter((t) => {
      const hay = `${t.title} ${t.overview} ${t.key} ${t.module}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, filter]);

  function sortByReadiness(a: Topic, b: Topic) {
    const ra = readinessByKey[a.key];
    const rb = readinessByKey[b.key];

    const aDue = ra?.dueNow ?? 0;
    const bDue = rb?.dueNow ?? 0;
    if (aDue !== bDue) return bDue - aDue;

    const aStab = ra?.avgStability ?? 0;
    const bStab = rb?.avgStability ?? 0;
    return aStab - bStab; // lower stability first
  }

  const ordered = useMemo(() => {
    return [...filtered].sort(sortByReadiness);
  }, [filtered, readinessByKey]);

  const dueTopics = useMemo(() => {
    return allTopics.filter((t) => (readinessByKey[t.key]?.dueNow ?? 0) > 0)
      .length;
  }, [readinessByKey]);

  return (
    <div className="grid gap-6">
      <AppCard
        title="Learn"
        subtitle="All topics covered by SQEz — sorted by readiness."
        right={<span className="chip">{dueTopics} topics due</span>}
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
              Due topics float to the top.
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
              <Link
                href="/app/session"
                className="btn btn-outline w-full sm:w-auto"
              >
                Quickfire
              </Link>
              <Link href="/app/revise" className="btn btn-ghost w-full sm:w-auto">
                Revise
              </Link>
            </div>
          </div>
        </div>
      </AppCard>

      <div className="grid gap-3">
        {ordered.map((t) => (
          <Link
            key={t.key}
            href={`/app/learn/${encodeURIComponent(t.key)}`}
            className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{t.title}</div>
                <div className="mt-1 text-xs text-white/60">{t.module}</div>
              </div>

              <StatusPill r={readinessByKey[t.key]} />
            </div>

            <div className="mt-3 text-sm leading-relaxed text-white/80">
              {t.overview}
            </div>
          </Link>
        ))}

        {ordered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
            No topics match your search.
          </div>
        ) : null}
      </div>
    </div>
  );
}