import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import OnboardingAuthGate from "@/components/onboarding/OnboardingAuthGate";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingAuthGate>
      <OnboardingProvider>{children}</OnboardingProvider>
    </OnboardingAuthGate>
  );
}