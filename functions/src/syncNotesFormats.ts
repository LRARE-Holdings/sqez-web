import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/* -----------------------------
   Shared helpers
----------------------------- */

function replaceAllCompat(s: string, a: string, b: string) {
  return s.split(a).join(b);
}

/* -----------------------------
   HTML → Plain Text
----------------------------- */

function stripHtmlToPlainText(html: string): string {
  let s = html;

  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");

  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<p[^>]*>/gi, "");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<div[^>]*>/gi, "");
  s = s.replace(/<\/li>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "• ");

  s = s.replace(/<[^>]+>/g, "");

  s = replaceAllCompat(s, "&nbsp;", " ");
  s = replaceAllCompat(s, "&amp;", "&");
  s = replaceAllCompat(s, "&lt;", "<");
  s = replaceAllCompat(s, "&gt;", ">");
  s = replaceAllCompat(s, "&quot;", "\"");
  s = replaceAllCompat(s, "&#039;", "'");

  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/* -----------------------------
   Plain Text → HTML
----------------------------- */

function escapeHtml(s: string) {
  let o = s;
  o = replaceAllCompat(o, "&", "&amp;");
  o = replaceAllCompat(o, "<", "&lt;");
  o = replaceAllCompat(o, ">", "&gt;");
  o = replaceAllCompat(o, "\"", "&quot;");
  o = replaceAllCompat(o, "'", "&#039;");
  return o;
}

function htmlFromPlainText(text: string): string {
  return `<p>${replaceAllCompat(escapeHtml(text), "\n", "<br/>")}</p>`;
}

/* -----------------------------
   Plain Text → RTF
----------------------------- */

function escapeRtf(s: string) {
  let o = s;
  o = replaceAllCompat(o, "\\", "\\\\");
  o = replaceAllCompat(o, "{", "\\{");
  o = replaceAllCompat(o, "}", "\\}");
  return o;
}

function rtfFromPlainText(text: string): string {
  const safe = escapeRtf(text).replace(/\n/g, "\\line ");
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\f0\\fs24 ${safe}}`;
}

/* -----------------------------
   RTF → Plain Text
----------------------------- */

function plainTextFromRtf(rtf: string): string {
  let s = rtf;

  s = s.replace(/\\par[d]?\s?/g, "\n");
  s = s.replace(/\\line\s?/g, "\n");

  s = s.replace(/\{\\\*?\\fonttbl[\s\S]*?\}/g, "");
  s = s.replace(/\{\\\*?\\colortbl[\s\S]*?\}/g, "");

  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, "");
  s = s.replace(/[{}]/g, "");

  s = replaceAllCompat(s, "\\\\", "\\");

  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/* -----------------------------
   Firestore Trigger
----------------------------- */

type NotesDoc = {
  html?: string;
  rtfBase64?: string;
  updatedBy?: string;
  updatedFormat?: "html" | "rtf";
  schemaVersion?: number;
  updatedAt?: admin.firestore.FieldValue;
};

export const syncNotesFormats = onDocumentWritten(
  {
    document: "users/{uid}/notes/{topicId}",
    region: "europe-west2",
  },
  async (event) => {
    const afterSnap = event.data?.after;
    const beforeSnap = event.data?.before;

    if (!afterSnap?.exists) return;

    const after = afterSnap.data() as NotesDoc;
    const before = beforeSnap?.exists
      ? (beforeSnap.data() as NotesDoc)
      : {};

    // 🚨 Never re-process sync writes
    if (after.updatedBy === "sync") return;

    const ref = afterSnap.ref;
    const updatedAt =
      after.updatedAt ?? admin.firestore.FieldValue.serverTimestamp();
    const schemaVersion = after.schemaVersion ?? 2;

    /* -------- Web → iOS -------- */

    if (
      after.updatedFormat === "html" &&
      typeof after.html === "string" &&
      after.html !== before.html
    ) {
      const plain = stripHtmlToPlainText(after.html);
      const rtf = rtfFromPlainText(plain);
      const rtfBase64 = Buffer.from(rtf, "utf8").toString("base64");

      await ref.set(
        {
          rtfBase64,
          updatedBy: "sync",
          updatedFormat: "rtf",
          updatedAt,
          schemaVersion,
        },
        { merge: true },
      );

      return;
    }

    /* -------- iOS → Web -------- */

    if (
      after.updatedFormat === "rtf" &&
      typeof after.rtfBase64 === "string" &&
      after.rtfBase64 !== before.rtfBase64
    ) {
      const rtf = Buffer.from(after.rtfBase64, "base64").toString("utf8");
      const plain = plainTextFromRtf(rtf);
      const html = htmlFromPlainText(plain);

      await ref.set(
        {
          html,
          updatedBy: "sync",
          updatedFormat: "html",
          updatedAt,
          schemaVersion,
        },
        { merge: true },
      );
    }
  },
);