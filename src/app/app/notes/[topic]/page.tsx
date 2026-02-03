"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import {
  Bold,
  ChevronLeft,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Layers,
  Library,
  List,
  ListOrdered,
  Quote,
  Save,
  Underline,
  Zap,
} from "lucide-react";

import { AppCard } from "@/components/ui/AppCard";
import { auth, db } from "@/lib/firebase/client";
import { allTopics } from "@/lib/topicCatalog";
import { subtopicsForTopicKey } from "@/lib/catalog/subtopics";

// TipTap
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionKeyDownProps } from "@tiptap/suggestion";

import tippy, { type Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";

/* ---------------------------------------------
   Helpers (topic resolving)
--------------------------------------------- */

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

/* ---------------------------------------------
   “@ Insert” catalog (V1 stub)
--------------------------------------------- */

type InsertItemType = "case" | "statute" | "subtopic";

type InsertItem = {
  id: string;
  type: InsertItemType;
  title: string;
  subtitle?: string;
  insertText: {
    heading: string;
    body?: string;
    citation?: string;
  };
};

function buildInsertItemsForTopic(topicKey: string, topicTitle: string) {
  // Replace with your real libraries later.
  const cases: InsertItem[] = [
    {
      id: "case-carlill",
      type: "case",
      title: "Carlill v Carbolic Smoke Ball Co",
      subtitle: "Offer to the world; acceptance by performance (1893).",
      insertText: {
        heading: "Case: Carlill v Carbolic Smoke Ball Co (1893)",
        body: "Unilateral offer to the world can be accepted by performance; intention/consideration satisfied on facts.",
        citation: "Use: offer, acceptance, unilateral contracts.",
      },
    },
    {
      id: "case-donoghue",
      type: "case",
      title: "Donoghue v Stevenson",
      subtitle: "Neighbour principle; duty of care foundation (1932).",
      insertText: {
        heading: "Case: Donoghue v Stevenson (1932)",
        body: "Neighbour principle: duty of care for reasonably foreseeable harm to those closely/directly affected.",
        citation: "Use: negligence duty of care.",
      },
    },
  ];

  const statutes: InsertItem[] = [
    {
      id: "statute-cra2015",
      type: "statute",
      title: "Consumer Rights Act 2015",
      subtitle: "Consumer contract rights & remedies.",
      insertText: {
        heading: "Statute: Consumer Rights Act 2015",
        body: "Key consumer rights (goods/services/digital) and remedies including repair, replacement, price reduction, rejection in certain cases.",
        citation: "Link: legislation.gov.uk",
      },
    },
    {
      id: "statute-limitation1980",
      type: "statute",
      title: "Limitation Act 1980",
      subtitle: "Time limits for civil claims.",
      insertText: {
        heading: "Statute: Limitation Act 1980",
        body: "Sets primary limitation periods and rules on accrual, postponement, and exceptions.",
        citation: "Use: deadlines, procedural bars.",
      },
    },
  ];

  const subs = subtopicsForTopicKey(topicKey).map<InsertItem>((s) => ({
    id: `subtopic-${s}`,
    type: "subtopic",
    title: s,
    subtitle: `Subtopic in ${topicTitle}`,
    insertText: {
      heading: `Subtopic: ${s}`,
      body: "Notes:",
    },
  }));

  return [...cases, ...statutes, ...subs];
}

function typeLabel(t: InsertItemType) {
  if (t === "case") return "Case";
  if (t === "statute") return "Statute";
  return "Subtopic";
}

/* ---------------------------------------------
   Suggestion dropdown UI (with keyboard support)
--------------------------------------------- */

type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const MentionList = React.forwardRef<
  MentionListHandle,
  { items: InsertItem[]; command: (item: InsertItem) => void }
>(function MentionListInner({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const it = items[index];
      if (it) command(it);
    },
    [items, command],
  );

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  return (
    <div className="w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1a2f] shadow-2xl">
      <div className="px-3 pt-3 pb-2">
        <div className="text-[11px] text-white/55">Insert into notes</div>
        <div className="mt-1 text-[12px] text-white/40">
          ↑/↓ to navigate · Enter to insert · Esc to close
        </div>
      </div>

      <div className="max-h-[340px] overflow-auto px-2 pb-2">
        {items.length === 0 ? (
          <div className="px-3 py-3 text-sm text-white/60">No matches.</div>
        ) : (
          items.slice(0, 30).map((it, idx) => {
            const active = idx === selectedIndex;
            return (
              <button
                key={it.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep editor focus
                  command(it);
                }}
                className={[
                  "w-full rounded-xl px-3 py-2 mb-1 text-left transition",
                  active ? "bg-white/10" : "bg-transparent hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                    {typeLabel(it.type)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white/90">{it.title}</div>
                    {it.subtitle ? (
                      <div className="line-clamp-2 text-[12px] text-white/60">{it.subtitle}</div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/50">
        Type <span className="text-white/70">@</span> then keep typing to filter.
      </div>
    </div>
  );
});

/* ---------------------------------------------
   TipTap “@ insert” extension (correctly implemented)
--------------------------------------------- */

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildAtInsertExtension(allItems: InsertItem[]) {
  return Extension.create({
    name: "atInsert",

    addProseMirrorPlugins() {
      return [
        Suggestion<InsertItem>({
          editor: this.editor,
          char: "@",
          startOfLine: false,
          allowSpaces: true,

          items: ({ query }) => {
            const q = (query ?? "").trim().toLowerCase();
            if (!q) return allItems.slice(0, 50);

            return allItems
              .filter((it) => {
                const hay = `${it.title} ${it.subtitle ?? ""}`.toLowerCase();
                return hay.includes(q);
              })
              .slice(0, 50);
          },

          command: ({ editor, range, props }) => {
            const it = props as InsertItem;

            editor.chain().focus().deleteRange(range).run();

            const block = [
              `<p><strong>${escapeHtml(it.insertText.heading)}</strong></p>`,
              it.insertText.body ? `<p>${escapeHtml(it.insertText.body)}</p>` : "",
              it.insertText.citation ? `<p><em>${escapeHtml(it.insertText.citation)}</em></p>` : "",
              `<p></p>`,
            ]
              .filter(Boolean)
              .join("");

            editor.commands.insertContent(block);
          },

          render: () => {
            let reactRenderer: ReactRenderer | null = null;
            let popup: TippyInstance | null = null;
            let listRef: MentionListHandle | null = null;

            return {
              onStart: (props) => {
                reactRenderer = new ReactRenderer(MentionList as any, {
                  editor: props.editor,
                  props: {
                    items: props.items as InsertItem[],
                    command: (it: InsertItem) => props.command(it),
                  },
                });

                // grab imperative handle for keyboard control
                listRef = (reactRenderer.ref as MentionListHandle) ?? null;

                const getRefRect = () => {
                  const r = props.clientRect?.();
                  return r ?? new DOMRect(0, 0, 0, 0);
                };

                popup = tippy(document.body, {
                  getReferenceClientRect: getRefRect,
                  appendTo: () => document.body,
                  content: reactRenderer.element as any,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  offset: [0, 8],
                  zIndex: 9999,
                });
              },

              onUpdate(props) {
                const getRefRect = () => {
                  const r = props.clientRect?.();
                  return r ?? new DOMRect(0, 0, 0, 0);
                };

                popup?.setProps({ getReferenceClientRect: getRefRect });

                reactRenderer?.updateProps({
                  items: props.items as InsertItem[],
                  command: (it: InsertItem) => props.command(it),
                });

                listRef = (reactRenderer?.ref as MentionListHandle) ?? null;
              },

              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }
                // arrow keys + enter routed into list
                if (listRef?.onKeyDown) return listRef.onKeyDown(props);
                return false;
              },

              onExit() {
                popup?.destroy();
                reactRenderer?.destroy();
                popup = null;
                reactRenderer = null;
                listRef = null;
              },
            };
          },
        }),
      ];
    },
  });
}

/* ---------------------------------------------
   Page
--------------------------------------------- */

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function TopicNotesPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const router = useRouter();

  const [rawTopic, setRawTopic] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const lastRemoteHtmlRef = useRef<string>("");
  const applyingRemoteRef = useRef(false);
  const [errorDetail, setErrorDetail] = useState<string>("");

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

  // IMPORTANT: web must match iOS document IDs for notes.
  // iOS currently uses the topic TITLE as the doc id (includes spaces).
  const noteDocId = useMemo(() => {
    return topic ? topic.title : "";
  }, [topic]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ?? null);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  const subtopics = useMemo(() => {
    if (!topic) return [];
    return [...subtopicsForTopicKey(topic.key)];
  }, [topic]);

  const insertItems = useMemo(() => {
    if (!topic) return [];
    return buildInsertItemsForTopic(topic.key, topic.title);
  }, [topic]);

  const notesRef = useMemo(() => {
    if (!authUser || !topic) return null;
    if (!noteDocId) return null;
    return doc(db, "users", authUser.uid, "notes", noteDocId);
  }, [authUser, topic, noteDocId]);

  // TipTap editor (important: options object, not a function)
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2] } }),
        UnderlineExt,
        Placeholder.configure({
          placeholder: "Write freely…\n\nTip: type @ to insert a case, statute, or subtopic.",
        }),
        buildAtInsertExtension(insertItems),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-invert max-w-none focus:outline-none min-h-[420px] px-4 py-4",
        },
      },
      content: "<p></p>",
      onUpdate: () => {
        // autosave handled by debounced effect below
      },
    },
    [topic?.key, authUser?.uid],
  );

  // Live sync notes from Firestore (also fixes “not syncing down”)
  useEffect(() => {
    setStatus("idle");
    setErrorDetail("");

    if (!authResolved) return;
    if (!authUser || !topic || !notesRef) {
      setLoading(false);
      return;
    }
    if (!editor) return;

    setLoading(true);

    // Force-refresh token once to avoid transient "missing/insufficient permissions" right after sign-in.
    void authUser.getIdToken(true);

    const unsub = onSnapshot(
      notesRef,
      (snap) => {
        const data = snap.exists() ? (snap.data() as DocumentData) : null;
        const html = typeof data?.html === "string" ? data.html : "";

        // Track last remote value so autosave can avoid echo-loops.
        lastRemoteHtmlRef.current = html || "";

        // Only apply remote updates if:
        // - we're not currently applying one
        // - editor isn't focused (avoid clobbering active typing)
        // - content differs
        const current = editor.getHTML();
        const shouldApply =
          !applyingRemoteRef.current &&
          !editor.isFocused &&
          (html || "") !== current;

        if (shouldApply) {
          applyingRemoteRef.current = true;
          editor.commands.setContent(html || "<p></p>", { emitUpdate: false });
          // release on next tick
          window.setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 0);
        }

        setLoading(false);
      },
      (err) => {
        // Permission / rules errors show up here too.
        setLoading(false);
        setStatus("error");
        setErrorDetail(err?.message ?? "Unknown Firestore error");
        window.setTimeout(() => setStatus("idle"), 1800);
      },
    );

    return () => {
      unsub();
    };
  }, [authResolved, authUser, topic?.key, notesRef, editor, topic]);

  // Save (manual + autosave uses same function)
  const saveNow = useCallback(
    async (mode: "manual" | "auto") => {
      if (!topic) return;

      if (!authUser || !notesRef) {
        router.push(
          `/auth?next=${encodeURIComponent(`/app/notes/${topic.key}`)}`,
        );
        return;
      }
      if (!editor) return;

      const html = editor.getHTML();

      // If we're currently applying a remote update, don't write it back.
      if (applyingRemoteRef.current) return;

      // If nothing changed vs last remote, skip.
      if (html === (lastRemoteHtmlRef.current || "")) return;

      setStatus("saving");
      try {
        await setDoc(
          notesRef,
          {
            // identifiers (helpful for strict rules + future migration)
            topicId: noteDocId,
            topicKey: topic.key,
            topicTitle: topic.title,

            // payload (web)
            html,

            // metadata
            schemaVersion: 2,
            updatedAt: serverTimestamp(),
            updatedBy: "web",
            updatedFormat: "html",

            // IMPORTANT: if your rules enforce "exactly one" of html/rtfBase64,
            // then a merge into an existing iOS note doc (which may already have rtfBase64)
            // will be denied. Clearing the other format avoids that.
            rtfBase64: deleteField(),
          },
          { merge: true },
        );
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), mode === "manual" ? 900 : 1200);
      } catch (e) {
        setStatus("error");
        // Surface error details to help debug rules / permission issues.
        const msg = (e as { message?: string; code?: string } | undefined);
        const detail = [msg?.code, msg?.message].filter(Boolean).join(": ");
        setErrorDetail(detail || "Could not save (unknown error)");
        // Also log to console for the exact Firebase error code.
        // eslint-disable-next-line no-console
        console.error("Notes save failed:", e);
        window.setTimeout(() => {
          setStatus("idle");
          setErrorDetail("");
        }, 2200);
      }
    },
    [authUser, editor, notesRef, rawTopic, router, topic, noteDocId],
  );

  // Autosave debounce (this is what makes it feel reliable)
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        if (applyingRemoteRef.current) return;
        void saveNow("auto");
      }, 900);
    };

    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [editor, saveNow]);

  const statusLabel = useMemo(() => {
    if (loading) return { text: "Loading…", tone: "text-white/55" };
    if (status === "saving") return { text: "Saving…", tone: "text-white/70" };
    if (status === "saved") return { text: "Saved", tone: "text-emerald-200/90" };
    if (status === "error") return { text: "Couldn’t save", tone: "text-amber-200/90" };
    return { text: "Autosaving on changes", tone: "text-white/55" };
  }, [loading, status]);

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
            Notes are private to your account. Type{" "}
            <span className="text-white/90">@</span> then keep typing to filter.
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link href="/app/notes" className="btn btn-ghost !no-underline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Link
            href={`/app/learn/${encodeURIComponent(topic.key)}`}
            className="btn btn-outline !no-underline"
          >
            Open topic
          </Link>
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04]">
        {/* Top bar */}
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <FileText className="h-5 w-5 text-white/70" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Notes</div>
              <div className={["text-xs", statusLabel.tone].join(" ")}>
                {statusLabel.text}
              </div>
              {errorDetail ? (
                <div className="mt-0.5 text-[11px] text-amber-200/90">
                  {errorDetail}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton
              label="H1"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              active={!!editor?.isActive("heading", { level: 1 })}
              icon={<Heading1 className="h-4 w-4" />}
            />
            <ToolbarButton
              label="H2"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              active={!!editor?.isActive("heading", { level: 2 })}
              icon={<Heading2 className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              label="Bold"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={!!editor?.isActive("bold")}
              icon={<Bold className="h-4 w-4" />}
            />
            <ToolbarButton
              label="Italic"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={!!editor?.isActive("italic")}
              icon={<Italic className="h-4 w-4" />}
            />
            <ToolbarButton
              label="Underline"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={!!editor?.isActive("underline")}
              icon={<Underline className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              label="Bullets"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={!!editor?.isActive("bulletList")}
              icon={<List className="h-4 w-4" />}
            />
            <ToolbarButton
              label="Numbered"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={!!editor?.isActive("orderedList")}
              icon={<ListOrdered className="h-4 w-4" />}
            />
            <ToolbarButton
              label="Quote"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              active={!!editor?.isActive("blockquote")}
              icon={<Quote className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <button
              type="button"
              className="btn btn-primary !no-underline"
              onClick={() => void saveNow("manual")}
              disabled={loading || status === "saving"}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </button>
          </div>
        </div>

        {/* Editor surface */}
        <div className="rounded-b-3xl bg-[#071427]/[0.30]">
          {editor ? (
            <EditorContent editor={editor} className="min-h-[420px] rounded-b-3xl" />
          ) : (
            <div className="min-h-[420px] px-4 py-4 text-sm text-white/60">
              Loading editor…
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-xs text-white/55">
          Tip: type <span className="text-white/80">@</span> then keep typing to filter · Enter to insert.
        </div>
      </div>

      {/* Side blocks */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <AppCard title="Quick actions" subtitle="Jump straight into practice on this topic.">
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
              <div className="mt-2 text-sm text-white/65">No subtopics available for this topic.</div>
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

/* ---------------------------------------------
   Toolbar UI bits
--------------------------------------------- */

function ToolbarDivider() {
  return <span className="mx-1 h-7 w-px bg-white/10" aria-hidden="true" />;
}

function ToolbarButton({
  label,
  onClick,
  active,
  icon,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      aria-pressed={active}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}