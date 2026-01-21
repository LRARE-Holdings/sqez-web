"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { OnboardingAnswers } from "@/lib/onboarding/store";

type Ctx = {
  answers: OnboardingAnswers;
  setAnswers: (patch: Partial<OnboardingAnswers>) => void;
  clear: () => void;
};

const KEY = "sqez_onboarding_v1";
const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswersState] = useState<OnboardingAnswers>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setAnswersState(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers]);

  const value = useMemo<Ctx>(
    () => ({
      answers,
      setAnswers: (patch) => setAnswersState((prev) => ({ ...prev, ...patch })),
      clear: () => {
        setAnswersState({});
        try { localStorage.removeItem(KEY); } catch {}
      },
    }),
    [answers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}