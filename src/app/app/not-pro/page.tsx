"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";

import { AppCard } from "@/components/ui/AppCard";
import { auth, db } from "@/lib/firebase/client";

type UserDoc = {
  firstName?: string;
  lastName?: string;
  email?: string;
  onboarding?: Record<string, unknown>;

  // Entitlement flags (single source of truth)
  isPro?: boolean;
  subscriptionTier?: string;
  betaUnlimited?: boolean;
};

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function tsToDate(v: unknown): Date | null {
  // Firestore Timestamp-like
  const maybe = v as Timestamp | any;
  if (maybe && typeof maybe.toDate === "function") {
    try {
      return maybe.toDate();
    } catch {
      return null;
    }
  }
  // ISO string fallback
  const s = asString(v);
  if (s) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function monthsUntil(d: Date) {
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

function inferRecommendation(onboarding?: Record<string, unknown>) {
  // Heuristic:
  // - if target exam is soon (<= 4 months): monthly
  // - else: annual (better value + consistency)
  const target =
    tsToDate(onboarding?.targetExamDate) ??
    tsToDate(onboarding?.examDate) ??
    tsToDate(onboarding?.examWindowStart);

  if (target) {
    const m = monthsUntil(target);
    if (m > 0 && m <= 4) return "MONTHLY" as const;
    return "ANNUAL" as const;
  }

  // time commitment heuristic fallback
  const hours = asNumber(onboarding?.hoursPerWeek);
  if (hours !== null && hours >= 10) return "ANNUAL" as const;

  // default: annual preference on web
  return "ANNUAL" as const;
}

async function startCheckout(user: User, plan: "MONTHLY" | "ANNUAL") {
  const token = await user.getIdToken();

  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });

  const data = (await res.json()) as { url?: string; error?: string };

  if (data.url) {
    window.location.assign(data.url);
    return;
  }

  throw new Error(data.error || `Stripe checkout failed (${res.status})`);
}

export default function NotProPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState<"MONTHLY" | "ANNUAL" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ?? null);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setUserDoc(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setUserDoc((snap.data() as UserDoc) || null);
        setLoading(false);
      },
      (err) => {
        console.error("not-pro user snapshot error", err);
        setUserDoc(null);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [authUser]);

  const isPro = useMemo(() => {
    if (!userDoc) return false;
    if (userDoc.isPro === true) return true;
    if (userDoc.betaUnlimited === true) return true;
    const tier = String(userDoc.subscriptionTier ?? "").toLowerCase();
    return tier.includes("pro");
  }, [userDoc]);

  useEffect(() => {
    // If the user is Pro, this page should never be shown.
    // Redirect to the app home once we have finished loading the doc.
    if (!loading && authUser && isPro) {
      router.replace("/app");
    }
  }, [loading, authUser, isPro, router]);

  const rec = useMemo(() => {
    return inferRecommendation(userDoc?.onboarding);
  }, [userDoc]);

  const prices = useMemo(() => {
    const monthly = 14.99;
    const annual = 79.99;
    const annualAsMonthly = annual / 12;
    const savingsPct = Math.round(((monthly - annualAsMonthly) / monthly) * 100);
    return { monthly, annual, annualAsMonthly, savingsPct };
  }, []);

  const displayName = useMemo(() => {
    const f = asString(userDoc?.firstName) || "";
    const l = asString(userDoc?.lastName) || "";
    const out = `${f} ${l}`.trim();
    return out || (authUser?.email ?? "there");
  }, [userDoc, authUser]);

  const onboardingHint = useMemo(() => {
    const ob = userDoc?.onboarding;
    if (!ob) return null;

    const target =
      tsToDate(ob?.targetExamDate) ??
      tsToDate(ob?.examDate) ??
      tsToDate(ob?.examWindowStart);

    const stage = asString(ob?.stage);
    const time = asNumber(ob?.hoursPerWeek);

    const bits: string[] = [];
    if (stage) bits.push(`Stage: ${stage}`);
    if (time !== null) bits.push(`${time} hrs/week`);
    if (target) {
      const m = monthsUntil(target);
      if (m > 0) bits.push(`Target: ~${Math.round(m)} months`);
    }

    return bits.length ? bits.join(" • ") : null;
  }, [userDoc]);

  return (
    <div className="grid gap-6">
      <AppCard
        title="SQEz Web is Pro-only"
        subtitle="To use SQEz on desktop, you’ll need an active SQEz Pro subscription."
      >
        <div className="mt-2 grid gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
            {loading ? (
              <>Checking your account…</>
            ) : isPro ? (
              <>You’re Pro — redirecting…</>
            ) : (
              <>
                Hi <span className="font-semibold text-white">{displayName}</span>. You’re
                signed in, but your account isn’t currently marked as{" "}
                <span className="font-semibold text-white">Pro</span>.
              </>
            )}
          </div>

          {onboardingHint ? (
            <div className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-white/80">
              Based on your onboarding, we think that the following plan would work best...
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Choose a plan to unlock SQEz Web. Annual is best value for most students.
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
              {error}{" "}
              <span className="text-rose-100/80">
                You can also{" "}
                <Link className="underline" href="/app/upgrade">
                  upgrade here
                </Link>
                .
              </span>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Annual */}
            <div
              className={[
                "rounded-3xl border px-5 py-5 bg-white/5",
                rec === "ANNUAL" ? "border-white/25" : "border-white/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Annual</div>
                  <div className="mt-1 text-xs text-white/60">Best value</div>
                </div>

                {rec === "ANNUAL" ? (
                  <span className="chip">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Suggested for you
                  </span>
                ) : (
                  <span className="chip">Save {prices.savingsPct}%</span>
                )}
              </div>

              <div className="mt-4">
                <div className="text-3xl font-semibold text-white">
                  £{prices.annual.toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-white/70">
                  ≈ £{prices.annualAsMonthly.toFixed(2)}/month billed yearly
                </div>
              </div>

              <ul className="mt-4 grid gap-2 text-sm text-white/75">
                <li>Full access to SQEz Web</li>
                <li>Best for sustained revision</li>
                <li>Preferential pricing vs monthly</li>
              </ul>

              <button
                type="button"
                className="btn btn-primary mt-5 w-full"
                disabled={busy !== null}
                onClick={async () => {
                  setError("");
                  setBusy("ANNUAL");
                  try {
                    if (!authUser) throw new Error("Not signed in");
                    await startCheckout(authUser, "ANNUAL");
                  } catch (e: any) {
                    setError(e?.message || "Couldn’t start checkout.");
                    setBusy(null);
                  }
                }}
              >
                {busy === "ANNUAL" ? "Redirecting…" : "Choose Annual"}
              </button>
            </div>

            {/* Monthly */}
            <div
              className={[
                "rounded-3xl border px-5 py-5 bg-white/5",
                rec === "MONTHLY" ? "border-white/25" : "border-white/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Monthly</div>
                  <div className="mt-1 text-xs text-white/60">Most flexible</div>
                </div>

                {rec === "MONTHLY" ? (
                  <span className="chip">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Suggested for you
                  </span>
                ) : (
                  <span className="chip">Flexible</span>
                )}
              </div>

              <div className="mt-4">
                <div className="text-3xl font-semibold text-white">
                  £{prices.monthly.toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-white/70">per month</div>
              </div>

              <ul className="mt-4 grid gap-2 text-sm text-white/75">
                <li>Full access to SQEz Web</li>
                <li>Best if your exam is soon</li>
                <li>Cancel anytime</li>
              </ul>

              <button
                type="button"
                className="btn btn-outline mt-5 w-full"
                disabled={busy !== null}
                onClick={async () => {
                  setError("");
                  setBusy("MONTHLY");
                  try {
                    if (!authUser) throw new Error("Not signed in");
                    await startCheckout(authUser, "MONTHLY");
                  } catch (e: any) {
                    setError(e?.message || "Couldn’t start checkout.");
                    setBusy(null);
                  }
                }}
              >
                {busy === "MONTHLY" ? "Redirecting…" : "Choose Monthly"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => window.location.reload()}
            >
              Refresh status
            </button>

            <Link href="/app/account" className="btn btn-ghost">
              Account
            </Link>

            <Link href="/app/upgrade" className="btn btn-ghost">
              View all pricing
            </Link>
          </div>

          <div className="text-xs text-white/55">
            If you’ve just upgraded, it can take a moment for Stripe to confirm your entitlement.
            Refresh once checkout completes.
          </div>
        </div>
      </AppCard>
    </div>
  );
}