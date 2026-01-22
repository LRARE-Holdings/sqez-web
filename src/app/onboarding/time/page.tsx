"use client";

import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { StudyPattern } from "@/lib/onboarding/store";
import { writeOnboarding } from "@/lib/onboarding/firestore";

export default function TimePage() {
  const router = useRouter();
  const { setAnswers } = useOnboarding();

  async function pick(studyPattern: StudyPattern) {
    setAnswers({ studyPattern });

    try {
      await writeOnboarding({ studyPattern });
    } catch (e) {
      console.error("writeOnboarding(studyPattern) failed", e);
    }

    router.push("/onboarding/funding");
  }

  return (
    <OnboardingShell
      step={4}
      total={6}
      title="On a realistic week, how could SQEz fit in?"
      subtitle="Consistency matters more than volume."
      backHref="/onboarding/exam-window"
    >
      <div className="grid gap-3">
        <OptionButton onClick={() => pick("DAILY_SHORT")}>10 minutes most days</OptionButton>
        <OptionButton onClick={() => pick("FEW_SESSIONS")}>Short sessions, 2–3 times a week</OptionButton>
        <OptionButton onClick={() => pick("ONE_LONG")}>One longer session per week</OptionButton>
        <OptionButton onClick={() => pick("VARIABLE")}>My schedule varies a lot</OptionButton>
      </div>

      <div className="mt-4 text-xs text-white/60">
        There’s no “right” answer — SQEz adapts to you.
      </div>
    </OnboardingShell>
  );
}