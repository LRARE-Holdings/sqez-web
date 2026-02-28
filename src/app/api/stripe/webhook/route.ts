import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { sendFreeTrialEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Missing STRIPE_SECRET_KEY env var");
  }

  stripeClient = new Stripe(secret, {
    apiVersion: "2025-12-15.clover",
  });
  return stripeClient;
}

function formatDateForEmail(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

async function resolveEmailForUser(params: {
  userData: Record<string, unknown> | null;
  stripeCustomerId?: string;
  sessionEmail?: string;
}): Promise<string | null> {
  const stripe = getStripe();
  const fromSession = typeof params.sessionEmail === "string" ? params.sessionEmail.trim() : "";
  if (fromSession) return fromSession;

  const fromUserDoc = typeof params.userData?.email === "string" ? params.userData.email.trim() : "";
  if (fromUserDoc) return fromUserDoc;

  // Best-effort fallback: look up Stripe customer email
  const cid = params.stripeCustomerId;
  if (!cid) return null;

  try {
    const cust = await stripe.customers.retrieve(cid);
    const email =
      !("deleted" in cust) && typeof cust.email === "string"
        ? cust.email.trim()
        : "";
    return email || null;
  } catch {
    return null;
  }
}

function tierForPlan(plan: string | undefined): string {
  const p = String(plan || "").trim().toUpperCase();
  return p === "ANNUAL" ? "pro_web_annual" : "pro_web_monthly";
}

function toDateFromUnixSeconds(sec: number | null | undefined): Date | null {
  if (!sec || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000);
}

function hasSubscriptionDefaultPaymentMethod(
  sub: Stripe.Subscription | null,
): boolean {
  if (!sub) return false;
  const dpm = sub.default_payment_method;
  if (typeof dpm === "string") return dpm.trim().length > 0;
  return Boolean(
    dpm &&
      typeof dpm === "object" &&
      typeof dpm.id === "string" &&
      dpm.id.trim(),
  );
}

function isEntitledStripeStatus(
  status: string | null | undefined,
  hasCardOnFile: boolean,
): boolean {
  // Free-trial users can access only if card details are already attached.
  return status === "active" || (status === "trialing" && hasCardOnFile);
}

function subStatusForStripeSubscription(sub: Stripe.Subscription): "trial" | "active" | "ended" {
  if (sub.status === "trialing" && sub.trial_end) return "trial";
  if (sub.status === "active") return "active";
  return "ended";
}

function extractUidPlanFromMetadata(meta: Stripe.Metadata | null | undefined) {
  const uid = meta?.uid ? String(meta.uid) : undefined;
  const plan = meta?.plan ? String(meta.plan) : undefined;
  return { uid, plan };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET or stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `Webhook signature failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    const db = adminDb();

    // We handle both “entitlement gained” and “entitlement lost”
    const handledTypes = new Set<string>([
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
    ]);

    if (!handledTypes.has(event.type)) {
      return NextResponse.json({ received: true });
    }

    const obj = asRecord(event.data.object as unknown);
    const customerDetails = asRecord(obj.customer_details);
    const subscriptionDetails = asRecord(obj.subscription_details);
    const objectMetadata = asRecord(obj.metadata) as Stripe.Metadata;
    const subscriptionDetailsMetadata = asRecord(
      subscriptionDetails.metadata,
    ) as Stripe.Metadata;

    const sessionEmail: string | null =
      event.type === "checkout.session.completed"
        ? (typeof customerDetails.email === "string" && customerDetails.email.trim()
            ? customerDetails.email.trim()
            : typeof obj.customer_email === "string" && obj.customer_email.trim()
              ? obj.customer_email.trim()
              : null)
        : null;

    // 1) Try to resolve subscriptionId
    const subscriptionId: string | undefined =
      typeof obj.subscription === "string"
        ? obj.subscription
        : event.type.startsWith("customer.subscription.") && typeof obj.id === "string"
          ? obj.id
          : undefined;

    // 2) Try to resolve uid/plan from whatever object we received
    // - checkout.session.completed: metadata is on session (we set it)
    // - invoice.*: subscription_details.metadata sometimes present; otherwise retrieve subscription
    // - customer.subscription.*: metadata is on subscription
    let uid: string | undefined;
    let plan: string | undefined;

    const metaA = extractUidPlanFromMetadata(objectMetadata);
    uid = metaA.uid;
    plan = metaA.plan;

    if (!uid || !plan) {
      const metaB = extractUidPlanFromMetadata(subscriptionDetailsMetadata);
      uid = uid || metaB.uid;
      plan = plan || metaB.plan;
    }

    // 3) Retrieve subscription (single source of truth) if we can.
    // This lets us:
    // - reliably read status (trialing/active/canceled/etc.)
    // - reliably read trial_end
    // - reliably read metadata (uid/plan) if missing above
    // - store customer id
    let sub: Stripe.Subscription | null = null;
    if (subscriptionId) {
      try {
        sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (!uid || !plan) {
          const metaSub = extractUidPlanFromMetadata(sub.metadata);
          uid = uid || metaSub.uid;
          plan = plan || metaSub.plan;
        }
      } catch {
        // If Stripe retrieval fails, we can still proceed if uid exists,
        // but trial/status fields may be unavailable.
        sub = null;
      }
    }

    if (!uid) {
      // Nothing we can do without a uid mapping.
      return NextResponse.json({ received: true });
    }

    const userRef = db.doc(`users/${uid}`);

    // Read current user doc once (needed for idempotent emails + firstName/email)
    let userData: Record<string, unknown> | null = null;
    try {
      const snap = await userRef.get();
      userData = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    } catch {
      userData = null;
    }

    // 4) Compute entitlement + trial info
    // IMPORTANT: only trust `obj.status` when the event object *is* a Subscription.
    // For invoices / checkout sessions, `obj.status` is not the subscription status.
    const stripeStatus: string | undefined =
      sub?.status ??
      (event.type.startsWith("customer.subscription.") && typeof obj?.status === "string"
        ? obj.status
        : undefined);

    // If we couldn't resolve a subscription status, do NOT mutate entitlement fields.
    // This avoids incorrect downgrades/upgrades caused by invoice/session statuses.
    const canMutateEntitlement = Boolean(stripeStatus);

    const hasCardOnFile = hasSubscriptionDefaultPaymentMethod(sub);
    const entitled = stripeStatus
      ? isEntitledStripeStatus(stripeStatus, hasCardOnFile)
      : false;

    const trialEndsAt = sub ? toDateFromUnixSeconds(sub.trial_end) : null;

    const currentPeriodEnd = sub
      ? Number(
          (sub as unknown as { current_period_end?: number }).current_period_end,
        )
      : null;
    const renewsAt = currentPeriodEnd ? toDateFromUnixSeconds(currentPeriodEnd) : null;

    const computedSubStatus = sub
      ? subStatusForStripeSubscription(sub)
      : entitled
        ? "active"
        : "ended";

    const tier = tierForPlan(plan);

    // “lastTransactionID” best-effort
    const lastTxn =
      getString(obj.id) ||
      getString(obj.payment_intent) ||
      getString(obj.latest_invoice) ||
      getString(obj.invoice) ||
      event.id;

    // Stripe returns `customer` as either a string id or an expanded object.
    // Normalize to a string id for Firestore + portal lookups.
    const objectCustomer = asRecord(obj.customer);

    const stripeCustomerId =
      (typeof sub?.customer === "string"
        ? sub.customer
        : sub?.customer && "id" in sub.customer && typeof sub.customer.id === "string"
          ? sub.customer.id
          : undefined) ||
      (typeof obj.customer === "string"
        ? obj.customer
        : typeof objectCustomer.id === "string"
          ? objectCustomer.id
          : undefined) ||
      // Checkout session sometimes exposes customer id here
      getString(customerDetails.customer);

    // 5) Write Firestore — single source of truth fields
    // - When entitled => isPro true
    // - When not entitled (deleted/canceled/etc.) => isPro false
    // - Always keep subStatus + trialEndsAt in sync if subscription present
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
      lastTransactionID: String(lastTxn),

      // Stripe IDs/status (useful for debugging + portal)
      stripeCustomerId: stripeCustomerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      stripeSubStatus: stripeStatus ?? null,
      stripeCardOnFile: sub ? hasCardOnFile : null,
    };

    if (canMutateEntitlement) {
      update.isPro = entitled;
      update.subscriptionTier = entitled ? tier : "free";
      update.subStatus = entitled ? computedSubStatus : "ended";
      if (entitled) update.proUpdatedAt = new Date();

      // If entitlement is lost, clear renewal date (even if we couldn't retrieve the subscription).
      if (!entitled) update.renewsAt = null;
    }

    if (
      subscriptionId &&
      stripeStatus &&
      stripeStatus !== "incomplete" &&
      stripeStatus !== "past_due" &&
      !(stripeStatus === "trialing" && !hasCardOnFile)
    ) {
      update.stripePendingSubscriptionId = null;
      update.stripePendingPlan = null;
      update.stripePendingDiscountCode = null;
      update.stripePendingUpdatedAt = null;
    }

    if (sub) {
      // Persist the renewal/current period end date for account UI.
      // Note: `renewsAt` is derived from `current_period_end` above.
      update.renewsAt = renewsAt ?? null;

      if (trialEndsAt) {
        update.trialEndsAt = trialEndsAt;
      } else if (sub.status !== "trialing") {
        // If we *have* the subscription and it’s not trialing, clear it
        update.trialEndsAt = null;
      }
    }

    // ✅ Send a “trial started” email once (even though Stripe won’t create a £0 receipt).
    // Idempotency marker lives on users/{uid}:
    // - trialStartEmailSentForSubId
    // - trialStartEmailSentAt
    if (
      canMutateEntitlement &&
      entitled &&
      computedSubStatus === "trial" &&
      subscriptionId &&
      trialEndsAt
    ) { 
      const alreadySentFor = typeof userData?.trialStartEmailSentForSubId === "string" ? userData.trialStartEmailSentForSubId : "";

      if (alreadySentFor !== subscriptionId) {
        const to = await resolveEmailForUser({
          userData,
          stripeCustomerId: stripeCustomerId ?? undefined,
          sessionEmail: sessionEmail ?? undefined,
        });

        if (to) {
          const existingEmail =
            typeof userData?.email === "string" ? userData.email.trim() : "";
          if (!existingEmail && to.trim()) {
            update.email = to.trim();
          }
          const firstName = typeof userData?.firstName === "string" ? userData.firstName : null;
          const planLabel: "Monthly" | "Annual" = String(plan || "").trim().toUpperCase() === "ANNUAL" ? "Annual" : "Monthly";

          try {
            await sendFreeTrialEmail({
              customerEmail: to,
              firstName,
              planLabel,
              trialEndsAt: formatDateForEmail(trialEndsAt),
            });

            update.trialStartEmailSentForSubId = subscriptionId;
            update.trialStartEmailSentAt = new Date();
          } catch (e) {
            // Don’t fail the webhook if email fails.
            const msg = e instanceof Error ? e.message : String(e);
            console.error("Resend free-trial email failed", msg, e);
          }
        }
      }
    }

    await userRef.set(update, { merge: true });

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("Webhook handler failed:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
