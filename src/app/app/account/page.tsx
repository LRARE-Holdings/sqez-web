"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
  updateEmail,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  type DocumentData,
  type Timestamp,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  BadgeCheck,
  CreditCard,
  KeyRound,
  Mail,
  PencilLine,
  UserRound,
  Loader2,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { auth, db } from "@/lib/firebase/client";
import { AppCard, AppCardSoft } from "@/components/ui/AppCard";

type UserDoc = {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  email?: string;
  firstName?: string;
  lastName?: string;

  isPro?: boolean;
  subscriptionTier?: string; // e.g. pro_web_monthly / pro_web_annual
  proUpdatedAt?: Timestamp;
  lastTransactionID?: string;

  // ✅ Subscription status mirrors (optional, but you said they exist in Firestore)
  subStatus?: string; // active, trialing, past_due, canceled, etc
  trialEndsAt?: Timestamp;
  cancelAtPeriodEnd?: boolean;

  onboardingCompleted?: boolean;

  onboarding?: Record<string, unknown>;

  // Optional (future-proof fields if you add them later)
  billingProvider?: "stripe" | "apple" | "unknown";
  billingMethodPreview?: string; // "Visa •••• 4242"
  currentPeriodEnd?: Timestamp; // when the current period ends (renewal date)
};

type SubscriptionDoc = {
  isPro?: boolean;
  tier?: string;
  billing?: string; // "stripe" etc

  // ✅ Mirrors from Stripe subscription
  status?: string; // active, trialing, etc
  trialEndsAt?: Timestamp;
  cancelAtPeriodEnd?: boolean;

  updatedAt?: Timestamp;
  currentPeriodEnd?: Timestamp;
};

function fmtTS(ts?: Timestamp) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

function fmtDate(ts?: Timestamp) {
  if (!ts) return "—";
  try {
    // en-GB: 27 Jan 2026
    return ts
      .toDate()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  } catch {
    return "—";
  }
}

function fullName(u?: UserDoc | null) {
  const f = typeof u?.firstName === "string" ? u.firstName.trim() : "";
  const l = typeof u?.lastName === "string" ? u.lastName.trim() : "";
  const out = `${f} ${l}`.trim();
  return out || "—";
}

function tierLabel(raw?: string) {
  const v = String(raw || "").toLowerCase();
  if (!v) return "—";
  if (v.includes("annual")) return "SQEz Pro (Annual)";
  if (v.includes("monthly")) return "SQEz Pro (Monthly)";
  if (v.includes("pro")) return "SQEz Pro";
  return raw || "—";
}

function subStatusLabel(raw?: string) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "—";

  // Canonical app labels
  if (v === "trial" || v === "trialing") return "Trial";
  if (v === "active") return "Active";
  if (v === "ended") return "Ended";

  // Stripe / subscription states
  if (v === "past_due") return "Past due";
  if (v === "unpaid") return "Unpaid";
  if (v === "incomplete") return "Incomplete";
  if (v === "incomplete_expired") return "Incomplete (expired)";
  if (v === "canceled" || v === "cancelled") return "Cancelled";
  if (v === "paused") return "Paused";

  // Default: Title Case + spaces
  return v.replace(/(^\w)|(_\w)/g, (m) => m.replace("_", " ").toUpperCase());
}

async function openBillingPortal(returnPath: string) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const token = await u.getIdToken();

  // Some portal endpoints accept an optional returnUrl; others hardcode it.
  // We send it, but the server can ignore it.
  const returnUrl = window.location.origin + returnPath;

  const res = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ returnUrl }),
  });

  if (!res.ok) {
    throw new Error(`Portal request failed (${res.status})`);
  }

  const data = (await res.json()) as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error || "No portal url returned");

  window.location.assign(data.url);
}

type SubStatus = "trial" | "active" | "ended" | string;

function formatSubStatus(s: SubStatus | null | undefined): string {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "—";

  // Canonical labels you care about
  if (v === "trial") return "Trial";
  if (v === "active") return "Active";
  if (v === "ended") return "Ended";

  // Stripe-ish fallbacks (if you ever display stripeSubStatus)
  if (v === "trialing") return "Trial";
  if (v === "canceled" || v === "cancelled") return "Cancelled";
  if (v === "past_due") return "Past due";
  if (v === "unpaid") return "Unpaid";
  if (v === "incomplete") return "Incomplete";

  // Default: Title Case the raw value
  return v.replace(/(^\w)|(_\w)/g, (m) => m.replace("_", " ").toUpperCase());
}

function StatusPill({
  tone,
  icon: Icon,
  label,
}: {
  tone: "good" | "warn" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
      : tone === "warn"
        ? "border-amber-200/20 bg-amber-200/10 text-amber-50"
        : "border-white/10 bg-white/5 text-white/80";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        cls,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const pathname = usePathname();

  const nextUrl = useMemo(() => {
    const p = pathname || "/app/account";
    return encodeURIComponent(p);
  }, [pathname]);

  const [authUser, setAuthUser] = useState<User | null>(null);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [subDoc, setSubDoc] = useState<SubscriptionDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<
    | { tone: "good" | "warn"; title: string; message: string }
    | null
  >(null);

  // Email actions
  const [emailDraft, setEmailDraft] = useState("");
  const [emailBusy, setEmailBusy] = useState<null | "update" | "verify">(null);

  const verifyEmailHref = useMemo(
    () => `/verify-email?next=${nextUrl}`,
    [nextUrl],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace(`/auth?next=${nextUrl}`);
        return;
      }
      setAuthUser(u);
      setEmailDraft(u.email || "");
    });

    return () => unsub();
  }, [router, nextUrl]);

  useEffect(() => {
    if (!authUser) return;

    setLoading(true);
    setBanner(null);

    const userRef = doc(db, "users", authUser.uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        setUserDoc((snap.data() as DocumentData | undefined) as UserDoc | null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setBanner({
          tone: "warn",
          title: "Couldn’t load your account",
          message: "Please refresh. If it continues, sign out and back in.",
        });
        setLoading(false);
      },
    );

    const subRef = doc(db, "users", authUser.uid, "subscription", "current");
    const unsubSub = onSnapshot(
      subRef,
      (snap) => {
        setSubDoc(
          (snap.data() as DocumentData | undefined) as SubscriptionDoc | null,
        );
      },
      () => setSubDoc(null),
    );

    return () => {
      unsubUser();
      unsubSub();
    };
  }, [authUser]);

  const pro = useMemo(() => {
    return (
      Boolean(userDoc?.isPro) ||
      Boolean(subDoc?.isPro) ||
      String(userDoc?.subscriptionTier || "").toLowerCase().includes("pro") ||
      String(subDoc?.tier || "").toLowerCase().includes("pro")
    );
  }, [userDoc, subDoc]);

  const tier = useMemo(() => {
    return userDoc?.subscriptionTier || subDoc?.tier || (pro ? "pro" : "—");
  }, [userDoc, subDoc, pro]);

  const billingProvider = useMemo(() => {
    const fromSub = String(subDoc?.billing || "").toLowerCase();
    const fromUser = String(userDoc?.billingProvider || "").toLowerCase();
    const fromTier = String(tier || "").toLowerCase();

    if (
      fromSub.includes("stripe") ||
      fromUser === "stripe" ||
      fromTier.includes("web")
    )
      return "Stripe (pay.lrare.co.uk)";
    if (
      fromSub.includes("apple") ||
      fromUser === "apple" ||
      fromTier.includes("apple")
    )
      return "Apple (iOS)";
    if (!fromSub && !fromUser) return "—";
    return "Unknown";
  }, [subDoc, userDoc, tier]);


  const subStatus = useMemo(() => {
    const s = String(subDoc?.status || userDoc?.subStatus || "").trim();
    if (s) return s;
    return pro ? "active" : "";
  }, [subDoc, userDoc, pro]);

  const trialEndsAt = subDoc?.trialEndsAt || userDoc?.trialEndsAt || undefined;

  const periodEnd =
    subDoc?.currentPeriodEnd || userDoc?.currentPeriodEnd || undefined;

  const renewalDate = periodEnd;

  const emailVerified = Boolean(authUser?.emailVerified);

  async function handleSignOut() {
    setBanner(null);
    try {
      await signOut(auth);
      router.replace("/auth");
    } catch (e: any) {
      setBanner({
        tone: "warn",
        title: "Couldn’t sign out",
        message: e?.message || "Please try again.",
      });
    }
  }

  async function handleManageBilling() {
    setBanner(null);

    if (billingProvider === "Apple (iOS)") {
      setBanner({
        tone: "warn",
        title: "Managed on iOS",
        message:
          "Your subscription is billed via Apple. Manage it in the App Store (Subscriptions).",
      });
      return;
    }

    try {
      await openBillingPortal("/app/account");
    } catch (e) {
      console.error(e);
      router.push("/app/upgrade");
    }
  }

  async function handleChangeBillingMethod() {
    await handleManageBilling();
  }

  async function handleUpdateEmail() {
    setBanner(null);

    const u = auth.currentUser;
    if (!u) return;

    const nextEmail = emailDraft.trim();
    if (!nextEmail) {
      setBanner({
        tone: "warn",
        title: "Email required",
        message: "Please enter a valid email address.",
      });
      return;
    }

    setEmailBusy("update");
    try {
      await updateEmail(u, nextEmail);

      await setDoc(
        doc(db, "users", u.uid),
        { email: nextEmail, updatedAt: serverTimestamp() },
        { merge: true },
      );

      setBanner({
        tone: "good",
        title: "Email updated",
        message: "Now verify it to keep everything working smoothly.",
      });
    } catch (e: any) {
      setBanner({
        tone: "warn",
        title: "Couldn’t update email",
        message:
          e?.code === "auth/requires-recent-login"
            ? "Please sign out and sign back in, then try again."
            : e?.message || "Please try again.",
      });
    } finally {
      setEmailBusy(null);
    }
  }

  async function handleSendVerification() {
    setBanner(null);

    const u = auth.currentUser;
    if (!u) return;

    if (u.emailVerified) {
      setBanner({
        tone: "good",
        title: "Already verified",
        message: "Your email is verified.",
      });
      return;
    }

    setEmailBusy("verify");
    try {
      await sendEmailVerification(u);
      setBanner({
        tone: "good",
        title: "Verification email sent",
        message: "Check your inbox (and spam). Then come back and refresh.",
      });
    } catch (e: any) {
      setBanner({
        tone: "warn",
        title: "Couldn’t send verification email",
        message:
          e?.code === "auth/too-many-requests"
            ? "You’ve requested too many emails. Please wait a bit and try again."
            : e?.message || "Please try again.",
      });
    } finally {
      setEmailBusy(null);
    }
  }


  return (
    <div className="grid gap-6">
      {/* Header */}
      <AppCard
        title="Account"
        subtitle="Profile, subscription, onboarding, and security."
        right={
          pro ? (
            <StatusPill tone="good" icon={BadgeCheck} label="SQEz Pro" />
          ) : (
            <StatusPill tone="warn" icon={AlertTriangle} label="Not Pro" />
          )
        }
      >
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            Loading your account…
          </div>
        ) : null}

        {banner ? (
          <div
            className={[
              "rounded-2xl border px-4 py-3",
              banner.tone === "good"
                ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
                : "border-amber-200/20 bg-amber-200/10 text-amber-50",
            ].join(" ")}
          >
            <div className="text-sm font-semibold">{banner.title}</div>
            <div className="mt-1 text-sm opacity-90">{banner.message}</div>
          </div>
        ) : null}

        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {/* Profile */}
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 lg:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserRound className="h-4 w-4 text-white/70" />
                  Profile
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {fullName(userDoc)}
                </div>
                <div className="mt-1 text-sm text-white/70">
                  {authUser?.email || userDoc?.email || "—"}
                </div>
              </div>

              <Link
                href={`/name?next=${encodeURIComponent("/app/account")}`}
                className="btn btn-ghost px-3 py-2 no-underline!"
              >
                <PencilLine className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Mail className="h-4 w-4 text-white/45" />
                  Email verified
                </div>
                {emailVerified ? (
                  <span className="inline-flex items-center gap-2 text-xs text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Yes
                  </span>
                ) : (
                  <span className="text-xs text-amber-100">No</span>
                )}
              </div>


              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-white/60">UID</div>
                <div className="max-w-45 truncate text-xs text-white/80">
                  {authUser?.uid || "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-outline w-full sm:w-auto no-underline!"
                onClick={handleSignOut}
              >
                Sign out
              </button>
              <Link
                href="/app"
                className="btn btn-ghost w-full sm:w-auto no-underline!"
              >
                Back to dashboard
              </Link>
            </div>
          </div>

          {/* Subscription */}
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CreditCard className="h-4 w-4 text-white/70" />
                  Subscription
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {pro ? subStatusLabel(subStatus) : "Not active"}
                </div>
                <div className="mt-1 text-sm text-white/65">{tierLabel(tier)}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Billing provider</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {billingProvider}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  {billingProvider === "Stripe (pay.lrare.co.uk)"
                    ? "Managed via pay.lrare.co.uk."
                    : billingProvider === "Apple (iOS)"
                      ? "Managed via App Store."
                      : "—"}
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Subscription status</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {pro ? subStatusLabel(subStatus) : "—"}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  {(() => {
                    const s = String(subStatus || "").toLowerCase();
                    const isTrial = s === "trial" || s === "trialing";
                    if (!isTrial) return "";
                    if (!trialEndsAt) return "Trial active.";
                    return `Trial ends ${fmtDate(trialEndsAt)}.`;
                  })()}
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">
                  {Boolean(subDoc?.cancelAtPeriodEnd || userDoc?.cancelAtPeriodEnd)
                    ? "Ends on"
                    : "Renews on"}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {fmtDate(renewalDate)}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  {Boolean(subDoc?.cancelAtPeriodEnd || userDoc?.cancelAtPeriodEnd)
                    ? "Your subscription will end at the end of this period unless you renew."
                    : "You may currently be in a trial period."}
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Last transaction</div>
                <div className="mt-2 max-w-[320px] truncate text-sm font-semibold text-white">
                  {userDoc?.lastTransactionID || "—"}
                </div>
              </AppCardSoft>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {!pro ? (
                <Link
                  href="/app/upgrade"
                  className="btn btn-outline w-full sm:w-auto no-underline!"
                >
                  Upgrade to Pro
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              ) : null}

              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto no-underline!"
                onClick={handleChangeBillingMethod}
              >
                Manage billing
              </button>
            </div>

            <div className="mt-3 text-xs text-white/55">
              Manage billing opens the Stripe customer portal (hosted at
              pay.lrare.co.uk) when available. If it can’t be opened, you’ll be
              routed to the upgrade page.
            </div>
          </div>
        </div>
      </AppCard>

      {/* Security */}
      <AppCard title="Security" subtitle="Email verification status">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Mail className="h-4 w-4 text-white/70" />
              Email
            </div>

            <div className="mt-3 grid gap-2">
              <label className="text-xs text-white/60" htmlFor="emailDraft">
                Change email
              </label>
              <input
                id="emailDraft"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="name@email.com"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-outline w-full no-underline!"
                onClick={handleUpdateEmail}
                disabled={emailBusy !== null}
              >
                {emailBusy === "update" ? "Updating…" : "Update email"}
              </button>

              {/* ✅ Hide resend button if already verified */}
              {!emailVerified ? (
                <button
                  type="button"
                  className="btn btn-ghost w-full no-underline!"
                  onClick={handleSendVerification}
                  disabled={emailBusy !== null}
                >
                  {emailBusy === "verify" ? "Sending…" : "Send verification email"}
                </button>
              ) : null}

              {!emailVerified ? (
                <Link
                  href={verifyEmailHref}
                  className="btn btn-primary w-full no-underline!"
                >
                  Verify now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center text-xs text-white/55">Verified. You’re good.</div>
              )}
            </div>
          </div>


          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-white/70" />
              Routing flags
            </div>

            <div className="mt-4 grid gap-2 text-sm text-white/80">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Onboarding</span>
                <span className="font-medium text-white/90">
                  {userDoc?.onboardingCompleted ? "Complete" : "Incomplete"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Pro</span>
                <span className="font-medium text-white/90">{pro ? "Yes" : "No"}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Updated</span>
                <span>{fmtTS(userDoc?.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  );
}