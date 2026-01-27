"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Layers,
  Zap,
  Settings2,
  ChevronLeft,
  Check,
  FileText,
  Library,
  Star,
} from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey, subtopicsForTopicName } from "@/lib/catalog/subtopics";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type Difficulty = "ALL" | "Easy" | "Medium" | "Hard";
type Mode = "quickfire" | "revise";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function compact(s: string): string {
  return s.replace(/\s+/g, "").trim();
}

function normalizeTopicKey(k: string): string {
  return (k || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveTopic(param: string) {
  const raw = (param ?? "").trim();
  const decoded = safeDecode(raw);

  const rawLower = raw.toLowerCase();
  const decodedLower = decoded.toLowerCase();

  const compactRawLower = compact(rawLower);
  const compactDecodedLower = compact(decodedLower);

  const byKey =
    allTopics.find((t) => t.key.toLowerCase() === rawLower) ??
    allTopics.find((t) => t.key.toLowerCase() === decodedLower) ??
    allTopics.find((t) => t.key.toLowerCase() === compactRawLower) ??
    allTopics.find((t) => t.key.toLowerCase() === compactDecodedLower);

  if (byKey) return byKey;

  const byTitle =
    allTopics.find((t) => t.title.toLowerCase() === decodedLower) ??
    allTopics.find((t) => t.title.toLowerCase() === rawLower);

  if (byTitle) return byTitle;

  const byCompactedTitle = allTopics.find(
    (t) => compact(t.title.toLowerCase()) === compactDecodedLower,
  );

  if (byCompactedTitle) return byCompactedTitle;

  return allTopics.find((t) => {
    const tKey = t.key.toLowerCase();
    const tTitle = t.title.toLowerCase();
    return (
      tKey.includes(compactDecodedLower) ||
      tTitle.includes(decodedLower) ||
      compact(tTitle).includes(compactDecodedLower)
    );
  });
}

/** Basic segmented control */
function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { key: T; label: string }[];
}) {
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

function TogglePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/7 hover:text-white",
      ].join(" ")}
    >
      {active ? <Check className="h-3.5 w-3.5 text-white/80" /> : null}
      {label}
    </button>
  );
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [rawKey, setRawKey] = useState("");
  const [mode, setMode] = useState<Mode>("quickfire");
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("ALL");
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesStatus, setNotesStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  // Resolve params.key safely (Next 16 dynamic params are async)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await params;
      if (cancelled) return;
      setRawKey((p?.key ?? "").trim());
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const topic = useMemo(() => {
    const k = rawKey.trim();
    return k ? resolveTopic(k) : undefined;
  }, [rawKey]);

  // Prefer querystring overrides if present (nice for back/forward)
  useEffect(() => {
    const m = sp.get("mode");
    const c = sp.get("count");
    const d = sp.get("difficulty");
    const subs = sp.get("subtopics");

    if (m === "quickfire" || m === "revise") setMode(m);

    if (c) setCount(clampInt(Number(c), 5, 40));

    if (d === "ALL" || d === "Easy" || d === "Medium" || d === "Hard")
      setDifficulty(d);

    if (subs) {
      const parsed = subs
        .split(",")
        .map((s) => safeDecode(s).trim())
        .filter(Boolean);
      setSelectedSubtopics(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtopics = useMemo(() => {
    if (!topic) return [];

    // 1) Prefer key-based lookup (canonical topic keys).
    const key1 = normalizeTopicKey(topic.key);
    const byKey = subtopicsForTopicKey(key1);
    if (byKey.length > 0) return [...byKey];

    // 2) Fall back to title-based lookup (handles catalog key mismatches).
    const byTitle = subtopicsForTopicName(topic.title);
    if (byTitle.length > 0) return [...byTitle];

    // 3) Some catalogs prefix the title with the module name or similar.
    const byModulePlusTitle = subtopicsForTopicName(`${topic.module} ${topic.title}`);
    if (byModulePlusTitle.length > 0) return [...byModulePlusTitle];

    return [];
  }, [topic]);

  // Keep selection sane when navigating between topics
  useEffect(() => {
    setSelectedSubtopics([]);
  }, [topic?.key]);

  useEffect(() => {
    // Prune any selections that aren't valid for the current topic.
    if (subtopics.length === 0) {
      if (selectedSubtopics.length > 0) setSelectedSubtopics([]);
      return;
    }

    setSelectedSubtopics((prev) => prev.filter((s) => subtopics.includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopics]);

  // Load notes from Firestore: users/{uid}/notes/{topicKey}
  useEffect(() => {
    setNotesStatus("idle");
    if (!topic) return;

    const user = auth.currentUser;
    if (!user) {
      setNotes("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const ref = doc(db, "users", user.uid, "notes", topic.key);
        const snap = await getDoc(ref);
        if (cancelled) return;

        const data = snap.exists() ? snap.data() : null;
        setNotes((data?.notes as string) ?? "");
      } catch {
        if (!cancelled) setNotes("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [topic]);

  async function saveNotes() {
    if (!topic) return;
    const user = auth.currentUser;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/app/learn/${topic.key}`)}`);
      return;
    }

    setSavingNotes(true);
    setNotesStatus("idle");

    try {
      const ref = doc(db, "users", user.uid, "notes", topic.key);
      await setDoc(
        ref,
        {
          topicKey: topic.key,
          topicTitle: topic.title,
          notes,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setNotesStatus("saved");
    } catch {
      setNotesStatus("error");
    } finally {
      setSavingNotes(false);
      window.setTimeout(() => setNotesStatus("idle"), 1800);
    }
  }

  function toggleSubtopic(s: string) {
    setSelectedSubtopics((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function start() {
    if (!topic) return;

    const base =
      mode === "revise" ? "/app/revise" : "/app/session";

    const q = new URLSearchParams();
    q.set("topic", topic.key);
    q.set("count", String(count));
    if (difficulty !== "ALL") q.set("difficulty", difficulty);
    if (selectedSubtopics.length > 0)
      q.set(
        "subtopics",
        selectedSubtopics.map((s) => encodeURIComponent(s)).join(","),
      );

    router.push(`${base}?${q.toString()}`);
  }

  if (!topic) {
    return (
      <div className="grid gap-6">
        <AppCard title="Topic not found" subtitle="Return to Learn and try again.">
          <div className="mt-2 text-sm text-white/70">
            Unknown topic key:{" "}
            <span className="text-white/90">{rawKey || "(empty)"}</span>
          </div>
          <div className="mt-4">
            <Link href="/app/learn" className="btn btn-primary no-underline!">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Learn
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
          <div className="text-xs text-white/60">{topic.module}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {topic.title}
          </div>
          <div className="mt-2 max-w-3xl text-sm leading-relaxed text-white/70">
            {topic.overview}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link href="/app/learn" className="btn btn-ghost no-underline!">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      {/* Study builder */}
      <AppCard
        title="Study this topic"
        subtitle="Choose how you want to practise. You’re always in control."
      >
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: mode + options */}
          <div className="lg:col-span-7">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Settings2 className="h-4 w-4 text-white/70" />
                  Session settings
                </div>

                <Segmented<Mode>
                  value={mode}
                  onChange={setMode}
                  items={[
                    { key: "quickfire", label: "Quickfire" },
                    { key: "revise", label: "Revise" },
                  ]}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AppCardSoft className="px-5 py-4">
                  <div className="text-xs text-white/60">Questions</div>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={40}
                      value={count}
                      onChange={(e) => setCount(clampInt(Number(e.target.value), 5, 40))}
                      className="w-full"
                    />
                    <div className="w-10 text-right text-sm font-semibold text-white">
                      {count}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    Keep it short and repeat often.
                  </div>
                </AppCardSoft>

                <AppCardSoft className="px-5 py-4">
                  <div className="text-xs text-white/60">Difficulty</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <TogglePill
                      active={difficulty === "ALL"}
                      label="All"
                      onClick={() => setDifficulty("ALL")}
                    />
                    <TogglePill
                      active={difficulty === "Easy"}
                      label="Easy"
                      onClick={() => setDifficulty("Easy")}
                    />
                    <TogglePill
                      active={difficulty === "Medium"}
                      label="Medium"
                      onClick={() => setDifficulty("Medium")}
                    />
                    <TogglePill
                      active={difficulty === "Hard"}
                      label="Hard"
                      onClick={() => setDifficulty("Hard")}
                    />
                  </div>
                </AppCardSoft>
              </div>

              {/* Subtopics (placeholder until we wire from Firestore) */}
              <AppCardSoft className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-white/60">Subtopics</div>
                    <div className="mt-1 text-sm text-white/75">
                      Filter your session to specific areas.
                    </div>
                  </div>

                  {selectedSubtopics.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-2 no-underline!"
                      onClick={() => setSelectedSubtopics([])}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {subtopics.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                    No subtopics are available for this topic yet.
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {subtopics.map((s) => (
                      <TogglePill
                        key={s}
                        active={selectedSubtopics.includes(s)}
                        label={s}
                        onClick={() => toggleSubtopic(s)}
                      />
                    ))}
                  </div>
                )}
              </AppCardSoft>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn btn-primary w-full sm:w-auto no-underline!"
                  onClick={start}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Start session
                </button>

                <Link
                  href={`/app/revise?topic=${encodeURIComponent(topic.key)}`}
                  className="btn btn-outline w-full sm:w-auto no-underline!"
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Revise
                </Link>
              </div>
            </div>
          </div>

          {/* Right: resources + key questions */}
          <div className="lg:col-span-5">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Library className="h-4 w-4 text-white/70" />
                  Resources
                </div>
                <div className="mt-2 text-sm text-white/70">
                  We’ll surface statutes, key cases, and links here per topic.
                </div>
                <div className="mt-3 text-xs text-white/55">
                  Next step: wire this to your StatuteLibrary / CaseLibrary.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Star className="h-4 w-4 text-white/70" />
                  Key questions
                </div>
                <div className="mt-2 text-sm text-white/70">
                  A curated list of “must-know” questions will live here.
                </div>
                <div className="mt-3 text-xs text-white/55">
                  Next step: add a Firestore collection for key questions by topic.
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Notes */}
      <AppCard
        title="Notes"
        subtitle="Private notes for this topic. Saved to your account."
      >
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <FileText className="h-4 w-4 text-white/45" />
              <span>Notes for {topic.title}</span>
            </div>

            <textarea
              className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              rows={8}
              placeholder="Write anything you want to remember — checklists, definitions, weak points, examples…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/60">
                {notesStatus === "saved" ? (
                  <span className="text-emerald-200/90">Saved</span>
                ) : notesStatus === "error" ? (
                  <span className="text-amber-200/90">Couldn’t save</span>
                ) : (
                  <span className="text-white/55">Autosave is optional — click save.</span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto no-underline!"
                onClick={saveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      </AppCard>

      <div className="text-xs text-white/55">
        Tip: Quickfire is best as your default. Use Revise when you want a tighter filter.
      </div>
    </div>
  );
}