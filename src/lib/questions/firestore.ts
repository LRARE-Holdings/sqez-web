import {
  collection,
  documentId,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { FireQuestion } from "./types";

const QUESTIONS_COL = "questions";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asAnswerIndex(value: unknown): 0 | 1 | 2 | 3 {
  const n = Math.trunc(asNumber(value, 0));
  if (n === 1 || n === 2 || n === 3) return n;
  return 0;
}

function asModule(value: unknown): FireQuestion["module"] {
  return value === "FLK2" ? "FLK2" : "FLK1";
}

function asOptions(value: unknown): FireQuestion["options"] {
  const arr = asStringArray(value);
  return [arr[0] ?? "", arr[1] ?? "", arr[2] ?? "", arr[3] ?? ""];
}

function normalize(
  docId: string,
  data: Record<string, unknown>,
): FireQuestion | null {
  // Canonical id is the Firestore doc id.
  return {
    active: Boolean(data.active),
    answerIndex: asAnswerIndex(data.answerIndex),
    createdAt: data.createdAt,
    createdByUid: asString(data.createdByUid),
    difficulty: asString(data.difficulty),
    explanation: asString(data.explanation),
    module: asModule(data.module),
    options: asOptions(data.options),
    question: asString(data.question),
    questionId: docId,
    subTopic: asString(data.subTopic),
    topic: asString(data.topic),
  };
}

export async function fetchActiveQuestions(
  max: number = 300,
): Promise<FireQuestion[]> {
  const qref = query(
    collection(db, QUESTIONS_COL),
    where("active", "==", true),
    limit(max),
  );
  const snap = await getDocs(qref);

  const out: FireQuestion[] = [];
  snap.forEach((d) => {
    const q = normalize(d.id, d.data() as Record<string, unknown>);
    if (q) out.push(q);
  });
  return out;
}

export async function fetchActiveQuestionsByTopic(
  topic: string,
  max: number = 300,
): Promise<FireQuestion[]> {
  const qref = query(
    collection(db, QUESTIONS_COL),
    where("active", "==", true),
    where("topic", "==", topic),
    limit(max),
  );
  const snap = await getDocs(qref);

  const out: FireQuestion[] = [];
  snap.forEach((d) => {
    const q = normalize(d.id, d.data() as Record<string, unknown>);
    if (q) out.push(q);
  });
  return out;
}

export async function fetchQuestionsByIds(ids: string[]): Promise<FireQuestion[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }

  const out: FireQuestion[] = [];
  for (const chunk of chunks) {
    const qref = query(
      collection(db, QUESTIONS_COL),
      where(documentId(), "in", chunk),
    );
    const snap = await getDocs(qref);
    snap.forEach((d) => {
      const q = normalize(d.id, d.data() as Record<string, unknown>);
      if (q) out.push(q);
    });
  }
  return out;
}
