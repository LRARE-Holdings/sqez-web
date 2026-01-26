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
  BookOpen,
  CreditCard,
  KeyRound,
  Mail,
  PencilLine,
  Phone,
  Shield,
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

  mfaEnrolled?: boolean;
  onboardingCompleted?: boolean;

  onboarding?: Record<string, unknown>;

  // Optional (future-proof fields if you add them later)
  billingProvider?: "stripe" | "apple" | "unknown";
  billingMethodPreview?: string; // "Visa •••• 4242"
  currentPeriodEnd?: Timestamp; // if you choose to mirror from Stripe
};

type SubscriptionDoc = {
  isPro?: boolean;
  tier?: string;
  billing?: string; // "stripe" etc
  updatedAt?: Timestamp;
  currentPeriodEnd?: Timestamp;
  paymentMethodPreview?: string;
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
    return ts.toDate().toLocaleDateString();
  } catch {
    return "—";
  }
}

function firstNameOnly(u?: UserDoc | null) {
  const f = typeof u?.firstName === "string" ? u.firstName.trim() : "";
  return f || "—";
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

async function openBillingPortal(returnPath: string) {
  // This creates a Stripe Customer Portal session server-side.
  // If you have a Stripe-hosted portal custom domain, Stripe will return a URL on that domain
  // (e.g. https://pay.lrare.co.uk/p/...)
  const res = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ returnUrl: window.location.origin + returnPath }),
  });

  if (!res.ok) throw new Error(`Portal request failed (${res.status})`);
  const data = (await res.json()) as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error || "No portal url returned");

  // Stripe returns the fully-qualified portal session URL (often on your portal custom domain).
  window.location.assign(data.url);
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

  // “Links” to your flows (these pages already exist in your project)
  const mfaHref = useMemo(() => `/mfa/enroll?next=${nextUrl}`, [nextUrl]);
  const verifyEmailHref = useMemo(() => `/verify-email?next=${nextUrl}`, [nextUrl]);

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
        setSubDoc((snap.data() as DocumentData | undefined) as SubscriptionDoc | null);
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

    if (fromSub.includes("stripe") || fromUser === "stripe" || fromTier.includes("web"))
      return "Stripe (pay.lrare.co.uk)";
    if (fromSub.includes("apple") || fromUser === "apple" || fromTier.includes("apple"))
      return "Apple (iOS)";
    if (!fromSub && !fromUser) return "—";
    return "Unknown";
  }, [subDoc, userDoc, tier]);

  const paymentMethodPreview =
    subDoc?.paymentMethodPreview || userDoc?.billingMethodPreview || "—";

  const periodEnd =
    subDoc?.currentPeriodEnd || userDoc?.currentPeriodEnd || undefined;

  const emailVerified = Boolean(authUser?.emailVerified);
  const mfaEnrolled = Boolean(userDoc?.mfaEnrolled);

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

    // If the user is billed via Apple, Stripe portal won't help.
    if (billingProvider === "Apple (iOS)") {
      setBanner({
        tone: "warn",
        title: "Managed on iOS",
        message: "Your subscription is billed via Apple. Manage it in the App Store (Subscriptions).",
      });
      return;
    }

    try {
      await openBillingPortal("/app/account");
    } catch (e) {
      console.error(e);
      // Fallback: send them to pricing/upgrade page if portal is unavailable
      router.push("/app/upgrade");
    }
  }

  async function handleChangeBillingMethod() {
    // In reality, “change billing method” is “manage subscription” in Stripe.
    // If you want to *switch provider* (Stripe ↔ Apple), that’s a separate product decision.
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

      // Mirror into Firestore (single source of truth for profile)
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

  const onboardingSummary = useMemo(() => {
    const o = (userDoc?.onboarding || {}) as Record<string, unknown>;
    const exam = o.targetExamDate;
    const stage = o.stage || o.persona || o.currentStage;
    const hrs = o.hoursPerWeek || o.timeCommitment || o.hours;
    const funding = o.funding || o.fundedBy;

    return {
      stage: typeof stage === "string" ? stage : "—",
      hours: typeof hrs === "number" ? `${hrs} / week` : "—",
      funding: typeof funding === "string" ? funding : "—",
      examDate:
        (exam as any)?.toDate?.()
          ? (exam as any).toDate().toLocaleDateString()
          : "—",
    };
  }, [userDoc]);

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
                className="btn btn-ghost px-3 py-2 !no-underline"
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
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Phone className="h-4 w-4 text-white/45" />
                  MFA enabled
                </div>
                <span className="text-xs text-white/85">
                  {mfaEnrolled ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-white/60">UID</div>
                <div className="max-w-[180px] truncate text-xs text-white/80">
                  {authUser?.uid || "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-outline w-full sm:w-auto !no-underline"
                onClick={handleSignOut}
              >
                Sign out
              </button>
              <Link
                href="/app"
                className="btn btn-ghost w-full sm:w-auto !no-underline"
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
                  {pro ? "Active" : "Not active"}
                </div>
                <div className="mt-1 text-sm text-white/65">
                  {tierLabel(tier)}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary px-4 py-2 !no-underline"
                onClick={handleManageBilling}
              >
                Manage billing
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
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
                <div className="text-xs text-white/60">Payment method</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {paymentMethodPreview}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Preview only (no sensitive card data stored).
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Renews / ends</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {fmtDate(periodEnd)}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  This shows when the current period ends.
                </div>
              </AppCardSoft>

              <AppCardSoft className="px-5 py-4">
                <div className="text-xs text-white/60">Last transaction</div>
                <div className="mt-2 max-w-[320px] truncate text-sm font-semibold text-white">
                  {userDoc?.lastTransactionID || "—"}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Stored for support + entitlement audits.
                </div>
              </AppCardSoft>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {!pro ? (
                <Link
                  href="/app/upgrade"
                  className="btn btn-outline w-full sm:w-auto !no-underline"
                >
                  Upgrade to Pro
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              ) : null}

              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto !no-underline"
                onClick={handleChangeBillingMethod}
              >
                Change billing method
              </button>
            </div>

            <div className="mt-3 text-xs text-white/55">
              Manage billing opens the Stripe customer portal (hosted at pay.lrare.co.uk) when available. If it can’t be opened, you’ll be routed to the upgrade page.
            </div>
          </div>
        </div>
      </AppCard>

      {/* Security */}
      <AppCard title="Security" subtitle="Email verification and MFA status.">
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
                className="btn btn-outline w-full !no-underline"
                onClick={handleUpdateEmail}
                disabled={emailBusy !== null}
              >
                {emailBusy === "update" ? "Updating…" : "Update email"}
              </button>

              <button
                type="button"
                className="btn btn-ghost w-full !no-underline"
                onClick={handleSendVerification}
                disabled={emailBusy !== null}
              >
                {emailBusy === "verify" ? "Sending…" : "Send verification email"}
              </button>

              {!emailVerified ? (
                <Link
                  href={verifyEmailHref}
                  className="btn btn-primary w-full !no-underline"
                >
                  Verify now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              ) : (
                <div className="text-xs text-white/55">
                  Verified. You’re good.
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-white/55">
              If Firebase asks for a recent login, sign out then sign back in and retry.
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Shield className="h-4 w-4 text-white/70" />
              MFA (SMS)
            </div>

            <div className="mt-2 text-sm text-white/70">
              Status:{" "}
              <span className="font-semibold text-white">
                {mfaEnrolled ? "Enabled" : "Not enabled"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Link href={mfaHref} className="btn btn-primary w-full !no-underline">
                Manage MFA
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>

              <div className="text-xs text-white/55">
                MFA is optional on web right now. You can add it for extra security.
              </div>
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
                <span className="font-medium text-white/90">
                  {pro ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Updated</span>
                <span>{fmtTS(userDoc?.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Onboarding */}
      <AppCard
        title="Onboarding"
        subtitle="Update your study setup anytime."
        right={
          <Link
            href="/onboarding/stage?mode=edit"
            className="btn btn-outline px-3 py-2 !no-underline"
          >
            Edit onboarding
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="text-xs text-white/60">Stage</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {onboardingSummary.stage}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="text-xs text-white/60">Time</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {onboardingSummary.hours}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="text-xs text-white/60">Target exam date</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {onboardingSummary.examDate}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 lg:col-span-3">
            <div className="text-xs text-white/60">Funding</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {onboardingSummary.funding}
            </div>
            <div className="mt-2 text-xs text-white/55">
              Edit onboarding if your circumstances change.
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="h-4 w-4 text-white/70" />
            Raw onboarding map (debug)
          </div>
          <pre className="mt-3 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
            {JSON.stringify(userDoc?.onboarding ?? {}, null, 2)}
          </pre>
        </div>
      </AppCard>

      {/* Metadata */}
      <AppCard title="Account details" subtitle="Stored in Firestore at users/{uid}.">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-sm text-white/80">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60">Created</span>
              <span>{fmtTS(userDoc?.createdAt)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-white/60">Updated</span>
              <span>{fmtTS(userDoc?.updatedAt)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-white/60">Pro updated</span>
              <span>{fmtTS(userDoc?.proUpdatedAt)}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-sm text-white/80">
            <div className="text-xs text-white/60">Plan + provider</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {tierLabel(tier)}
            </div>
            <div className="mt-1 text-sm text-white/70">{billingProvider}</div>

            <div className="mt-4 text-xs text-white/55">
              If you want “runs out” / “renews” to be accurate, mirror the Stripe
              subscription’s <code className="px-1">current_period_end</code> into
              Firestore (users/{`{uid}`}/subscription/current). This page will display it
              automatically.
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  );
}