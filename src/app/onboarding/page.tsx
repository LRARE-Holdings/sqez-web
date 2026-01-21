"use client";

import { useRouter } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <OnboardingShell
      step={1}
      total={6}
      title="Welcome to SQEz"
      subtitle="SQEz isn’t a course. It’s a daily system that builds legal judgement, confidence, and recall — without overwhelm."
    >
      <button
        className="btn btn-primary w-full"
        type="button"
        onClick={() => router.push("/onboarding/stage")}
      >
        Personalise my experience
      </button>

      <div className="mt-3 text-xs text-white/60">
        Takes about 2–3 minutes. You can change anything later.
      </div>
    </OnboardingShell>
  );
}