import {
  collection,
  getDocs,
  query,
  where,
  limit,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { FireQuestion } from "./types";

const QUESTIONS_COL = "questions";

function normalize(docId: string, data: any): FireQuestion | null {
  // canonical id is the Firestore doc id
  return {
    active: Boolean(data.active),
    answerIndex: data.answerIndex,
    createdAt: data.createdAt,
    createdByUid: String(data.createdByUid ?? ""),
    difficulty: String(data.difficulty ?? ""),
    explanation: String(data.explanation ?? ""),
    module: data.module,
    options: data.options,
    question: String(data.question ?? ""),
    questionId: docId,
    subTopic: String(data.subTopic ?? ""),
    topic: String(data.topic ?? ""),
  };
}

export async function fetchActiveQuestions(max: number = 300): Promise<FireQuestion[]> {
  const qref = query(
    collection(db, QUESTIONS_COL),
    where("active", "==", true),
    limit(max),
  );
  const snap = await getDocs(qref);

  const out: FireQuestion[] = [];
  snap.forEach((d) => {
    const q = normalize(d.id, d.data());
    if (q) out.push(q);
  });
  return out;
}

export async function fetchQuestionsByIds(ids: string[]): Promise<FireQuestion[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const out: FireQuestion[] = [];
  for (const chunk of chunks) {
    const qref = query(
      collection(db, QUESTIONS_COL),
      where(documentId(), "in", chunk),
    );
    const snap = await getDocs(qref);
    snap.forEach((d) => {
      const q = normalize(d.id, d.data());
      if (q) out.push(q);
    });
  }
  return out;
}