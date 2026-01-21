"use client";

import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { Funding } from "@/lib/onboarding/store";

export default function FundingPage() {
  const router = useRouter();
  const { setAnswers } = useOnboarding();

  function pick(funding: Funding) {
    setAnswers({ funding });
    router.push("/onboarding/background");
  }

  return (
    <OnboardingShell
      step={5}
      total={6}
      title="How is your SQE preparation being supported?"
      subtitle="This helps us tailor pricing, reminders, and support."
      backHref="/onboarding/time"
    >
      <div className="grid gap-3">
        <OptionButton onClick={() => pick("SELF")}>I’m self-funding</OptionButton>
        <OptionButton onClick={() => pick("EMPLOYER")}>Supported by an employer or firm</OptionButton>
        <OptionButton onClick={() => pick("INSTITUTION")}>Sponsored by an institution</OptionButton>
        <OptionButton onClick={() => pick("DECLINED")}>Prefer not to say</OptionButton>
      </div>
    </OnboardingShell>
  );
}