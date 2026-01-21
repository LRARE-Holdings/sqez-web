"use client";

import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { ExamWindow } from "@/lib/onboarding/store";

export default function ExamWindowPage() {
  const router = useRouter();
  const { setAnswers } = useOnboarding();

  function pick(examWindow: ExamWindow) {
    setAnswers({ examWindow });
    router.push("/onboarding/time");
  }

  return (
    <OnboardingShell
      step={3}
      total={6}
      title="When are you aiming to sit your next exam?"
      subtitle="A rough idea is perfect — we’ll adapt as you go."
      backHref="/onboarding/stage"
    >
      <div className="grid gap-3">
        <OptionButton onClick={() => pick("0_3")}>Within the next 3 months</OptionButton>
        <OptionButton onClick={() => pick("3_6")}>In 3–6 months</OptionButton>
        <OptionButton onClick={() => pick("6_12")}>In 6–12 months</OptionButton>
        <OptionButton onClick={() => pick("UNSURE")}>I’m not sure yet</OptionButton>
      </div>
    </OnboardingShell>
  );
}