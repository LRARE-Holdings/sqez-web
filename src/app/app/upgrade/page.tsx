"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";

import { auth, db } from "@/lib/firebase/client";

type Status = "checking-auth" | "checkout" | "waiting-entitlement" | "active" | "error";
type Plan = "MONTHLY" | "ANNUAL";

type CheckoutIntentResponse = {
  publishableKey?: string;
  clientSecret?: string;
  intentType?: "setup" | "payment";
  trialDays?: number;
  error?: string;
};

type CheckoutIntentData = {
  publishableKey: string;
  clientSecret: string;
  intentType: "setup" | "payment";
  trialDays: number;
};

type UserEntitlementDoc = {
  isPro?: boolean;
};

const PLAN_COPY: Record<
  Plan,
  { label: string; trialDays: number; price: string; note: string }
> = {
  MONTHLY: {
    label: "Monthly",
    trialDays: 14,
    price: "£14.99 / month",
    note: "Maximum flexibility",
  },
  ANNUAL: {
    label: "Annual",
    trialDays: 30,
    price: "£79.99 / year",
    note: "Best value",
  },
};

function parsePlan(v: string | null): Plan | null {
  if (v === "MONTHLY" || v === "ANNUAL") return v;
  return null;
}

function CheckoutPaymentForm({
  intent,
  plan,
  onWaitingForEntitlement,
  onError,
}: {
  intent: CheckoutIntentData;
  plan: Plan;
  onWaitingForEntitlement: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "Please check your payment details.");
      setSubmitting(false);
      return;
    }

    const returnUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/app/upgrade?plan=${plan}&pending=1`
        : "/app/upgrade";

    if (intent.intentType === "setup") {
      const { error } = await stripe.confirmSetup({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Couldn’t confirm your payment details.");
        setSubmitting(false);
        return;
      }
    } else {
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Couldn’t confirm your payment.");
        setSubmitting(false);
        return;
      }
    }

    onWaitingForEntitlement();
    setSubmitting(false);
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">
        Secure payment
      </div>

      <div className="mt-4">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
      </div>

      <button
        type="button"
        className="btn btn-primary mt-5 w-full"
        disabled={!stripe || !elements || submitting}
        onClick={() => void handleConfirm()}
      >
        {submitting ? "Processing…" : `Start ${PLAN_COPY[plan].trialDays}-day free trial`}
      </button>

      <div className="mt-3 text-xs text-white/55">
        Card and supported wallets only. No charge today.
      </div>
    </div>
  );
}

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const queryPlan = parsePlan(searchParams.get("plan"));
  const queryString = searchParams.toString();
  const nextHref = useMemo(
    () => encodeURIComponent(`/app/upgrade${queryString ? `?${queryString}` : ""}`),
    [queryString],
  );

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(queryPlan);
  const [discountCode, setDiscountCode] = useState("");
  const [intent, setIntent] = useState<CheckoutIntentData | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const [status, setStatus] = useState<Status>("checking-auth");
  const [detail, setDetail] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const activePlan = selectedPlan ?? queryPlan;

  const stripePromise = useMemo(() => {
    if (!intent?.publishableKey) return null;
    return loadStripe(intent.publishableKey);
  }, [intent?.publishableKey]);

  const elementsOptions = useMemo<StripeElementsOptions | null>(
    () =>
      intent
        ? {
            clientSecret: intent.clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#eaeaea",
                colorBackground: "rgba(10, 26, 47, 0.7)",
                colorText: "#eaeaea",
                colorDanger: "#fda4af",
                borderRadius: "12px",
              },
              rules: {
                ".Label": { color: "rgba(234, 234, 234, 0.72)" },
              },
            },
          }
        : null,
    [intent],
  );

  useEffect(() => {
    if (queryPlan) setSelectedPlan(queryPlan);
  }, [queryPlan]);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    let redirectTimer: number | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user ?? null);

      // Always tear down any previous doc listener / timer
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
        redirectTimer = null;
      }

      if (!user) {
        router.replace(`/auth?next=${nextHref}`);
        return;
      }

      setStatus((prev) =>
        prev === "waiting-entitlement" || prev === "active" ? prev : "checkout",
      );
      setDetail("");

      // ✅ Single source of truth: users/{uid}.isPro
      const ref = doc(db, "users", user.uid);

      unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data() as UserEntitlementDoc | undefined;

          if (data?.isPro === true) {
            setStatus("active");
            // Keep the brief success state, but avoid stacking timers in dev/HMR.
            if (!redirectTimer) {
              redirectTimer = window.setTimeout(() => router.replace("/app"), 900);
            }
            return;
          }

          if (sessionId) {
            setStatus("waiting-entitlement");
            setDetail("Finalising your upgrade… this can take a few seconds.");
            return;
          }

          setStatus((prev) =>
            prev === "waiting-entitlement" ? prev : "checkout",
          );
        },
        (err) => {
          console.error(err);
          setStatus("error");
          setDetail("We couldn’t confirm your upgrade yet. Please refresh.");
        },
      );
    });

    return () => {
      if (unsubDoc) unsubDoc();
      if (redirectTimer) window.clearTimeout(redirectTimer);
      unsubAuth();
    };
  }, [nextHref, router, sessionId]);

  async function startCheckout() {
    if (!authUser) {
      router.replace(`/auth?next=${nextHref}`);
      return;
    }
    if (!activePlan) {
      setErrorMessage("Choose a plan to continue.");
      return;
    }

    setStartingCheckout(true);
    setErrorMessage("");
    setIntent(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: activePlan,
          discountCode: discountCode.trim() || undefined,
        }),
      });

      const data = (await res.json()) as CheckoutIntentResponse;

      if (!res.ok) {
        throw new Error(data.error || `Checkout failed (${res.status})`);
      }

      if (
        !data.clientSecret ||
        !data.publishableKey ||
        (data.intentType !== "setup" && data.intentType !== "payment")
      ) {
        throw new Error("Checkout initialization returned invalid data.");
      }

      setIntent({
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        intentType: data.intentType,
        trialDays:
          typeof data.trialDays === "number" ? data.trialDays : PLAN_COPY[activePlan].trialDays,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn’t initialize checkout.";
      setErrorMessage(message);
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">SQEz Pro</div>
          {sessionId ? (
            <div className="text-[11px] text-white/50">session: {sessionId}</div>
          ) : null}
        </div>

        {(status === "waiting-entitlement" || status === "checking-auth") && (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              You&apos;re almost in.
            </h1>
            <p className="mt-2 text-sm text-white/75">
              {detail || "Confirming your subscription…"}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
              If you&apos;re seeing this for more than ~20 seconds, refresh the
              page — your webhook may still be processing.
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <Link href="/onboarding/plan" className="btn btn-outline w-full sm:w-auto">
                Back to plan
              </Link>
            </div>
          </>
        )}

        {status === "checkout" && (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Secure checkout
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Keep it quick: pick your plan, add an optional code, then confirm with card or wallet.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(["ANNUAL", "MONTHLY"] as const).map((plan) => {
                const selected = activePlan === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan);
                      setIntent(null);
                      setErrorMessage("");
                    }}
                    className={[
                      "rounded-2xl border px-4 py-4 text-left transition",
                      selected
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                    disabled={startingCheckout}
                  >
                    <div className="text-sm font-semibold text-white">
                      {PLAN_COPY[plan].label}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {PLAN_COPY[plan].note}
                    </div>
                    <div className="mt-3 text-lg font-semibold text-white">
                      {PLAN_COPY[plan].price}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Free trial - {PLAN_COPY[plan].trialDays} days
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/55">
                Discount code (optional)
              </label>
              <input
                className="input"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value);
                  setIntent(null);
                }}
                placeholder="Enter code"
                autoComplete="off"
                disabled={startingCheckout}
              />
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            {!intent ? (
              <button
                type="button"
                className="btn btn-primary mt-5 w-full"
                onClick={() => void startCheckout()}
                disabled={startingCheckout || !activePlan}
              >
                {startingCheckout ? "Preparing…" : "Continue to payment"}
              </button>
            ) : null}

            {intent && stripePromise && elementsOptions ? (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <CheckoutPaymentForm
                  intent={intent}
                  plan={activePlan ?? "ANNUAL"}
                  onWaitingForEntitlement={() => {
                    setStatus("waiting-entitlement");
                    setDetail("Finalising your upgrade… this can take a few seconds.");
                    setErrorMessage("");
                  }}
                  onError={(msg) => setErrorMessage(msg)}
                />
              </Elements>
            ) : null}

            <div className="mt-4 text-xs text-white/55">
              Promo and coupon codes are supported. Entitlement is activated once Stripe webhook confirmation lands.
            </div>
          </>
        )}

        {status === "active" && (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Upgrade confirmed ✅
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Your SQEz Pro access is now active. Redirecting you to the dashboard…
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/app" className="btn btn-primary w-full sm:w-auto">
                Go to dashboard
              </Link>
              <Link href="/app/session" className="btn btn-outline w-full sm:w-auto">
                Start a session
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              We couldn’t confirm yet
            </h1>
            <p className="mt-2 text-sm text-white/75">{detail}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <Link href="/app" className="btn btn-outline w-full sm:w-auto">
                Go to app
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
