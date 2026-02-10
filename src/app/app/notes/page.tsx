"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { ChevronRight, FileText, Search, X } from "lucide-react";

import { AppCard, AppCardSoft } from "@/components/ui/AppCard";
import { auth, db } from "@/lib/firebase/client";
import { allTopics } from "@/lib/topicCatalog";
import { canonicalTopicKey } from "@/lib/topicKeys";

type NoteDoc = {
  topicKey?: string;
  topicTitle?: string;
  notes?: string;
  html?: string;
  updatedAt?: Timestamp | { toDate?: () => Date } | string | null;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function tsToDate(v: unknown): Date | null {
  const maybe = v as any;
  if (maybe && typeof maybe.toDate === "function") {
    try {
      return maybe.toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function snippet(text: string, max = 140) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NotesIndexPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [topicsWithNotes, setTopicsWithNotes] = useState<
    Array<{ id: string; topicKey: string; topicTitle: string; notes: string; updatedAt: Date | null }>
  >([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ?? null);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) {
      // Show all topics with empty notes when no user
      const emptyTopics = allTopics.map((topic) => ({
        id: topic.key,
        topicKey: topic.key,
        topicTitle: topic.title,
        notes: "",
        updatedAt: null,
      }));
      setTopicsWithNotes(emptyTopics);
      setLoadingNotes(false);
      return;
    }

    setLoadingNotes(true);

    const ref = collection(db, "users", authUser.uid, "notes");
    const qq = query(ref, orderBy("updatedAt", "desc"));

    const unsub = onSnapshot(
      qq,
      (snap) => {
        // Build a map of topicKey -> note metadata
        const notesMap = new Map<string, { id: string; notes: string; updatedAt: Date | null }>();
        snap.docs.forEach((d) => {
          const data = d.data() as NoteDoc;
          const candidates = [asString(data.topicKey), asString(data.topicTitle), d.id];
          const topicKey = candidates.map((v) => canonicalTopicKey(v)).find(Boolean) ?? null;
          if (!topicKey) return;

          const notes = asString(data.notes) || htmlToText(asString(data.html));
          const updatedAt = tsToDate(data.updatedAt);
          if (!notesMap.has(topicKey)) {
            notesMap.set(topicKey, { id: d.id, notes, updatedAt });
          }
        });

        // Build full list from allTopics, merging note metadata where present
        const merged = allTopics.map((topic) => {
          const noteMeta = notesMap.get(topic.key);
          return {
            id: noteMeta?.id ?? topic.key,
            topicKey: topic.key,
            topicTitle: topic.title,
            notes: noteMeta?.notes ?? "",
            updatedAt: noteMeta?.updatedAt ?? null,
          };
        });

        setTopicsWithNotes(merged);
        setLoadingNotes(false);
      },
      (err) => {
        console.error("notes index snapshot error", err);
        // On error, fall back to allTopics with empty notes
        const emptyTopics = allTopics.map((topic) => ({
          id: topic.key,
          topicKey: topic.key,
          topicTitle: topic.title,
          notes: "",
          updatedAt: null,
        }));
        setTopicsWithNotes(emptyTopics);
        setLoadingNotes(false);
      },
    );

    return () => unsub();
  }, [authUser]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return topicsWithNotes;

    return topicsWithNotes.filter((n) => {
      const hay = `${n.topicTitle}\n${n.topicKey}\n${n.notes}`.toLowerCase();
      return hay.includes(term);
    });
  }, [q, topicsWithNotes]);

  const totalCount = filtered.length;

  if (loadingAuth) {
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
        <AppCard title="Notes" subtitle="Sign in to see your notes.">
          <Link href="/auth?next=%2Fapp%2Fnotes" className="btn btn-primary no-underline!">
            Sign in
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight text-white">Notes</div>
          <div className="mt-1 text-sm text-white/70">
            All topics, with your notes saved per topic.
          </div>
        </div>
      </div>

      {/* Filters */}
      <AppCard
        title="Notes"
        subtitle="Search by topic name or the content you’ve written."
      >
        <div className="mt-2 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            {/* Search */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Search className="h-4 w-4 text-white/45" />
                <span>Search notes</span>
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
                placeholder="e.g. consideration, injunction, easement…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* Stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <FileText className="h-4 w-4 text-white/45" />
                <span>Topics</span>
              </div>
              <div className="mt-2 text-sm text-white/80">
                {loadingNotes ? (
                  <>Loading…</>
                ) : (
                  <>
                    Showing <span className="text-white/90">{totalCount}</span>{" "}
                    topic{totalCount === 1 ? "" : "s"}
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-white/55">
                Notes are saved per topic and sync across devices.
              </div>
            </div>
          </div>

          {/* Filter strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-white/60">
              {loadingNotes ? (
                <>Loading…</>
              ) : (
                <>
                  Showing <span className="text-white/85">{filtered.length}</span>{" "}
                  topic{filtered.length === 1 ? "" : "s"}
                </>
              )}
            </div>

            {q.trim().length > 0 ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-2 no-underline!"
                onClick={() => setQ("")}
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
        {loadingNotes ? (
          <AppCardSoft className="px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2">
                <FileText className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Loading notes…</div>
                <div className="mt-1 text-sm text-white/70">
                  Fetching your topic notes.
                </div>
              </div>
            </div>
          </AppCardSoft>
        ) : filtered.length === 0 ? (
          <AppCardSoft className="px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2">
                <FileText className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">No topics found</div>
                <div className="mt-1 text-sm text-white/70">
                  Try clearing your search, or search for a topic name.
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn btn-outline no-underline!"
                    onClick={() => setQ("")}
                  >
                    Clear search
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </AppCardSoft>
        ) : (
          filtered.map((n) => (
            <Link
              key={`${n.topicKey}-${n.id}`}
              href={`/app/notes/${encodeURIComponent(n.topicKey)}`}
              className="no-underline!"
            >
              <AppCardSoft className="px-5 py-5 hover:bg-white/7 transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white">{n.topicTitle}</div>
                    <div className="mt-2 text-sm text-white/70">
                      {n.notes.trim().length > 0 ? (
                        snippet(n.notes)
                      ) : (
                        <span className="italic text-white/40">No notes yet</span>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-white/55">
                      Updated: <span className="text-white/70">{fmtDate(n.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className="btn btn-outline w-full sm:w-auto">
                      Open notes
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </span>
                  </div>
                </div>
              </AppCardSoft>
            </Link>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="text-xs text-white/55">
        Tip: topic notes are private to you and saved under <code className="px-1">users/&lt;uid&gt;/notes/&lt;topicDocId&gt;</code>.
      </div>
    </div>
  );
}
