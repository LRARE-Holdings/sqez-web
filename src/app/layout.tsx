import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";

export const metadata: Metadata = {
  title: "SQEz — daily SQE revision",
  description:
    "Mobile-first, behaviour-driven SQE study: exam-standard MCQs, Autopsy Mode, confidence tracking, and habit-forming daily sessions.",
  metadataBase: new URL("https://sqez.lrare.co.uk"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <Suspense>
          <OnboardingGate>
            {children}
          </OnboardingGate>
        </Suspense>
      </body>
    </html>
  );
}