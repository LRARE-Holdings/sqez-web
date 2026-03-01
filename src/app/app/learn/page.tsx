"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Zap, Layers, Clock } from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { allTopics, type Topic } from "@/lib/topicCatalog";
import { getItemMetas } from "@/lib/engineStore";
import { canonicalTopicKey } from "@/lib/topicKeys";
import { useExamReadyLock } from "@/lib/examReadyLock";

type ModuleFilter = "ALL" | "FLK1" | "FLK2";

type TopicReadiness = {
  totalItems: number;
  dueNow: number;
  avgStability: number;
  avgDifficulty: number;
};

function Segmented({
  value,
  onChange,
}: {
  value: ModuleFilter;
  onChange: (v: ModuleFilter) => void;
}) {
  const items: { key: ModuleFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "FLK1", label: "FLK1" },
    { key: "FLK2", label: "FLK2" },
  ];

  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={[
              "rounded-xl px-3 py-2 text-xs transition",
              active
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/7 hover:text-white",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function topicKeyForItem(item: { tags: string[] }): string | null {
  const topicTag = (item.tags?.[1] ?? "").trim();
  if (!topicTag) return null;

  return canonicalTopicKey(topicTag);
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
    out[key] = {
      totalItems: v.total,
      dueNow: v.due,
      avgStability: v.total ? v.stabSum / v.total : 0,
      avgDifficulty: v.total ? v.diffSum / v.total : 0,
    };
  }

  return out;
}

function sortByReadiness(readinessByKey: Record<string, TopicReadiness>) {
  return (a: Topic, b: Topic) => {
    const ra = readinessByKey[a.key];
    const rb = readinessByKey[b.key];

    const aDue = ra?.dueNow ?? 0;
    const bDue = rb?.dueNow ?? 0;
    if (aDue !== bDue) return bDue - aDue;

    const aStab = ra?.avgStability ?? 0;
    const bStab = rb?.avgStability ?? 0;
    return aStab - bStab; // lower stability first
  };
}

function DueBadge({ due }: { due: number }) {
  if (!due) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
      <Clock className="h-3.5 w-3.5 text-white/50" />
      {due} due
    </span>
  );
}

function ExamReadyBadge({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-200/10 px-3 py-1.5 text-xs text-emerald-50">
      Exam-ready
    </span>
  );
}

export default function LearnPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModuleFilter>("ALL");
  const [readinessByKey, setReadinessByKey] = useState<
    Record<string, TopicReadiness>
  >({});
  const examReady = useExamReadyLock();

  useEffect(() => {
    setReadinessByKey(buildReadinessMap());
  }, []);

  const dueTopics = useMemo(() => {
    return allTopics.filter((t) => (readinessByKey[t.key]?.dueNow ?? 0) > 0)
      .length;
  }, [readinessByKey]);

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

  const ordered = useMemo(() => {
    return [...filtered].sort(sortByReadiness(readinessByKey));
  }, [filtered, readinessByKey]);

  return (
    <div className="grid gap-6">
      <AppCard
        title="Learn"
        subtitle="Browse topics. Due content floats to the top."
        right={
          <div className="flex items-center gap-2">

          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <label
              className="block text-xs font-medium text-white/70"
              htmlFor="topicSearch"
            >
              Search
            </label>

            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <Search className="h-4 w-4 text-white/40" />
              <input
                id="topicSearch"
                className="w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40"
                placeholder="Contract, Land, CPR…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/60">Module</div>
            <Segmented value={filter} onChange={setFilter} />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/session"
              className="btn btn-primary px-4 py-3 !no-underline"
            >
              <Zap className="mr-2 h-4 w-4" />
              Quickfire
            </Link>
            <Link
              href="/app/revise"
              className="btn btn-outline px-4 py-3 !no-underline"
            >
              <Layers className="mr-2 h-4 w-4" />
              Revise
            </Link>
          </div>
        </div>
      </AppCard>

      {/* Topic grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        {ordered.map((t) => {
          const r = readinessByKey[t.key];
          const due = r?.dueNow ?? 0;
          const topicLock = examReady.byTopic[t.key];
          const topicExamReady = Boolean(topicLock?.locked);
          const practiceLocked =
            examReady.mode === "enforce" && topicExamReady;

          return (
            <Link
              key={t.key}
              href={`/app/learn/${encodeURIComponent(t.key)}`}
              className="block rounded-2xl border border-white/10 bg-white/5 px-5 py-5 transition hover:bg-white/7 !no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {t.title}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{t.module}</div>
                  {practiceLocked ? (
                    <div className="mt-2 text-xs text-amber-100/90">
                      Practice is locked for now. Open topic to unlock for one
                      session.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <ExamReadyBadge locked={topicExamReady} />
                  <DueBadge due={due} />
                </div>
              </div>

              <div className="mt-3 text-sm leading-relaxed text-white/75">
                {t.overview}
              </div>
            </Link>
          );
        })}

        {ordered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 text-sm text-white/70 lg:col-span-2">
            No topics match your search.
          </div>
        ) : null}
      </div>
    </div>
  );
}
