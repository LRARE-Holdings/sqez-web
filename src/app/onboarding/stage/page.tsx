"use client";

import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { SqeStage } from "@/lib/onboarding/store";

export default function StagePage() {
  const router = useRouter();
  const { setAnswers } = useOnboarding();

  function pick(stage: SqeStage) {
    setAnswers({ stage });
    router.push("/onboarding/exam-window");
  }

  return (
    <OnboardingShell
      step={2}
      total={6}
      title="Where are you in your SQE journey?"
      subtitle="This helps us prioritise the right material."
      backHref="/onboarding"
    >
      <div className="grid gap-3">
        <OptionButton onClick={() => pick("FLK1")}>SQE1 — FLK1</OptionButton>
        <OptionButton onClick={() => pick("FLK2")}>SQE1 — FLK2</OptionButton>
        <OptionButton onClick={() => pick("BOTH")}>SQE1 — both FLKs</OptionButton>
        <OptionButton onClick={() => pick("SQE2")}>SQE2</OptionButton>
        <OptionButton onClick={() => pick("RETAKE")}>Retaking an exam</OptionButton>
      </div>
    </OnboardingShell>
  );
}