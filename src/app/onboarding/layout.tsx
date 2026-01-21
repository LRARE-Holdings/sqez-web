import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingProvider>{children}</OnboardingProvider>;
}