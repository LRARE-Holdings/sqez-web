"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { canonicalTopicKey } from "@/lib/topicKeys";
import { computeTopicLockStatuses } from "./scoring";
import type {
  ExamReadyHookResult,
  ExamReadyMode,
  QuestionStatSnapshot,
} from "./types";

const OVERRIDE_KEY_PREFIX = "sqez.examReady.unlock.";

function parseMode(): ExamReadyMode {
  const raw = (process.env.NEXT_PUBLIC_EXAM_READY_LOCK_MODE ?? "observe")
    .trim()
    .toLowerCase();
  return raw === "enforce" ? "enforce" : "observe";
}

function storageKeyForTopic(topicKey: string): string | null {
  const canonical = canonicalTopicKey(topicKey);
  if (!canonical) return null;
  return `${OVERRIDE_KEY_PREFIX}${canonical}`;
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function useExamReadyLock(): ExamReadyHookResult {
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [byTopic, setByTopic] = useState<ExamReadyHookResult["byTopic"]>({});
  const mode = useMemo(() => parseMode(), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      setByTopic({});
      setReady(true);
      return;
    }

    setReady(false);
    const ref = collection(db, "users", uid, "questionStats");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const stats: QuestionStatSnapshot[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            questionId:
              typeof data.questionId === "string" ? data.questionId : d.id,
            topic: typeof data.topic === "string" ? data.topic : "",
            totalAttempts: Number(data.totalAttempts ?? 0),
            correctCount: Number(data.correctCount ?? 0),
            incorrectCount: Number(data.incorrectCount ?? 0),
            lastConfidence: Number(data.lastConfidence ?? Number.NaN),
          };
        });

        setByTopic(computeTopicLockStatuses(stats, mode));
        setReady(true);
      },
      () => {
        setByTopic({});
        setReady(true);
      },
    );

    return () => unsub();
  }, [authReady, uid, mode]);

  const setTopicOverride = useCallback((topicKey: string) => {
    if (!canUseSessionStorage()) return false;
    const key = storageKeyForTopic(topicKey);
    if (!key) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  }, []);

  const hasTopicOverride = useCallback((topicKey: string) => {
    if (!canUseSessionStorage()) return false;
    const key = storageKeyForTopic(topicKey);
    if (!key) return false;
    return window.sessionStorage.getItem(key) === "1";
  }, []);

  const consumeTopicOverride = useCallback((topicKey: string) => {
    if (!canUseSessionStorage()) return false;
    const key = storageKeyForTopic(topicKey);
    if (!key) return false;
    const had = window.sessionStorage.getItem(key) === "1";
    if (had) window.sessionStorage.removeItem(key);
    return had;
  }, []);

  const lockedTopicKeys = useMemo(() => {
    const out = new Set<string>();
    for (const status of Object.values(byTopic)) {
      if (status.locked) out.add(status.topicKey);
    }
    return out;
  }, [byTopic]);

  return {
    ready,
    mode,
    lockedTopicKeys,
    byTopic,
    setTopicOverride,
    hasTopicOverride,
    consumeTopicOverride,
  };
}
