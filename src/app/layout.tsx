import type { Metadata } from "next";
import "./globals.css";
import "./marketing-home.css";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "SQEz - Master the SQE",
  description:
    "SQEz is an SQE training platform, built for students, by students.",
  metadataBase: new URL("https://sqez.lrare.co.uk"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-950 text-zinc-50 antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        <SpeedInsights />
      </body>
    </html>
  );
}
