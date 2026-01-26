"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ChevronLeft, FileText, Library, Layers, Zap } from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { auth, db } from "@/lib/firebase/client";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey } from "@/lib/catalog/subtopics";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function compact(s: string): string {
  return s.replace(/\s+/g, "").trim();
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

export default function TopicNotesPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const router = useRouter();

  const [rawTopic, setRawTopic] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  // Resolve params.topic safely
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await params;
      if (cancelled) return;
      setRawTopic((p?.topic ?? "").trim());
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const topic = useMemo(() => {
    const k = rawTopic.trim();
    return k ? resolveTopic(k) : undefined;
  }, [rawTopic]);

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ?? null);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  // load notes doc
  useEffect(() => {
    setStatus("idle");

    if (!authResolved) return;

    if (!authUser) {
      setNotes("");
      setLoading(false);
      return;
    }

    if (!topic) {
      setNotes("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    void (async () => {
      try {
        const ref = doc(db, "users", authUser.uid, "notes", topic.key);
        const snap = await getDoc(ref);
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        setNotes(asString(data?.notes));
      } catch {
        if (!cancelled) setNotes("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authResolved, authUser, topic?.key]);

  const subtopics = useMemo(() => {
    if (!topic) return [];
    return [...subtopicsForTopicKey(topic.key)];
  }, [topic]);

  async function save() {
    if (!topic) return;

    if (!authUser) {
      router.push(`/auth?next=${encodeURIComponent(`/app/notes/${rawTopic}`)}`);
      return;
    }

    setSaving(true);
    setStatus("idle");

    try {
      const ref = doc(db, "users", authUser.uid, "notes", topic.key);
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

      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      window.setTimeout(() => setStatus("idle"), 1600);
    }
  }

  if (!topic) {
    return (
      <div className="grid gap-6">
        <AppCard title="Topic not found" subtitle="Return to notes and try again.">
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/app/notes" className="btn btn-primary !no-underline">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to notes
            </Link>
            <Link href="/app/learn" className="btn btn-outline !no-underline">
              Browse topics
            </Link>
          </div>
        </AppCard>
      </div>
    );
  }

  if (!authResolved) {
    return (
      <div className="grid gap-6">
        <AppCard title="Notes" subtitle="Loading…">
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Checking your account…
          </div>
        </AppCard>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="grid gap-6">
        <AppCard title="Notes" subtitle="Sign in to view and edit your notes.">
          <Link
            href={`/auth?next=${encodeURIComponent(`/app/notes/${topic.key}`)}`}
            className="btn btn-primary !no-underline"
          >
            Sign in
          </Link>
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
          <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{topic.title}</div>
          <div className="mt-2 text-sm text-white/70">
            Private notes saved to your account.
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link href="/app/notes" className="btn btn-ghost !no-underline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Link href={`/app/learn/${encodeURIComponent(topic.key)}`} className="btn btn-outline !no-underline">
            Open topic
          </Link>
        </div>
      </div>

      {/* Notes editor */}
      <AppCard title="Notes" subtitle="Write freely. Save when you’re ready.">
        <div className="mt-2 grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <FileText className="h-4 w-4 text-white/45" />
              <span>Notes for {topic.title}</span>
            </div>

            <textarea
              className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              rows={10}
              placeholder="Definitions, checklists, weak points, examples, mnemonics…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/60">
                {loading ? (
                  <span className="text-white/55">Loading…</span>
                ) : status === "saved" ? (
                  <span className="text-emerald-200/90">Saved</span>
                ) : status === "error" ? (
                  <span className="text-amber-200/90">Couldn’t save</span>
                ) : (
                  <span className="text-white/55">Saved manually — press Save.</span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto !no-underline"
                onClick={save}
                disabled={saving || loading}
              >
                {saving ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Handy links */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <AppCard
            title="Quick actions"
            subtitle="Jump straight into practice on this topic."
          >
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/app/session?topic=${encodeURIComponent(topic.key)}`}
                className="btn btn-primary w-full sm:w-auto !no-underline"
              >
                <Zap className="mr-2 h-4 w-4" />
                Start session
              </Link>
              <Link
                href={`/app/revise?topic=${encodeURIComponent(topic.key)}`}
                className="btn btn-outline w-full sm:w-auto !no-underline"
              >
                <Layers className="mr-2 h-4 w-4" />
                Revise
              </Link>
            </div>
          </AppCard>
        </div>

        <div className="lg:col-span-5">
          <AppCard title="Topic context" subtitle="Subtopics for this topic.">
            {subtopics.length === 0 ? (
              <div className="mt-2 text-sm text-white/65">
                No subtopics available for this topic.
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {subtopics.map((s) => (
                  <span key={s} className="chip">
                    <Library className="mr-2 h-3.5 w-3.5 text-white/55" />
                    {s}
                  </span>
                ))}
              </div>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
}