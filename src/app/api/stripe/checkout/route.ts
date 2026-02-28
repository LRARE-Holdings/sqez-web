import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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

type Plan = "MONTHLY" | "ANNUAL";
type IntentType = "setup" | "payment";
type InvoiceWithPaymentIntent = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null;
};
type SubscriptionForCheckout = Stripe.Subscription & {
  latest_invoice?: Stripe.Invoice | string | null;
  pending_setup_intent?: Stripe.SetupIntent | string | null;
};

type UserBillingDoc = {
  stripeCustomerId?: string;
  stripePendingSubscriptionId?: string;
  stripePendingPlan?: Plan;
  stripePendingDiscountCode?: string;
};

function priceIdForPlan(plan: Plan) {
  if (plan === "MONTHLY") return process.env.STRIPE_PRICE_WEB_MONTHLY;
  return process.env.STRIPE_PRICE_WEB_ANNUAL;
}

function normalizeCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function hashIdempotencyKey(raw: string): string {
  const digest = createHash("sha256").update(raw).digest("hex");
  return `checkout_${digest.slice(0, 40)}`;
}

async function resolveDiscount(code: string) {
  const stripe = getStripe();
  // Primary path: user-facing promo/discount code.
  const promos = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
  });

  const promo = promos.data.find((item) => item.active);
  if (promo) {
    return { promotion_code: promo.id } as const;
  }

  // Fallback for teams that pass a coupon id directly.
  try {
    const coupon = await stripe.coupons.retrieve(code);
    if (!("deleted" in coupon) && coupon.valid) {
      return { coupon: coupon.id } as const;
    }
  } catch {
    // No-op; we'll return invalid discount below.
  }

  return null;
}

async function ensureCustomer(uid: string, email: string | undefined) {
  const stripe = getStripe();
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists
    ? (userSnap.data() as UserBillingDoc)
    : null;

  const existingId =
    typeof userData?.stripeCustomerId === "string"
      ? userData.stripeCustomerId.trim()
      : "";

  if (existingId) {
    try {
      const existing = await stripe.customers.retrieve(existingId);
      if (
        !("deleted" in existing) &&
        typeof existing.metadata?.uid === "string" &&
        existing.metadata.uid === uid
      ) {
        return { customerId: existing.id, userRef, userData };
      }
    } catch {
      // Customer was removed or id is stale; create a new one.
    }
  }

  const created = await stripe.customers.create({
    email,
    metadata: { uid },
  });

  await userRef.set(
    {
      stripeCustomerId: created.id,
      updatedAt: new Date(),
    },
    { merge: true },
  );

  return {
    customerId: created.id,
    userRef,
    userData: {
      ...(userData ?? {}),
      stripeCustomerId: created.id,
    },
  };
}

async function getCheckoutIntentFromSubscription(
  subscriptionId: string,
): Promise<{ clientSecret: string | null; intentType: IntentType }> {
  const stripe = getStripe();
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
  })) as SubscriptionForCheckout;

  const pendingSetupIntent =
    typeof subscription.pending_setup_intent === "string"
      ? await stripe.setupIntents.retrieve(subscription.pending_setup_intent)
      : subscription.pending_setup_intent;

  const latestInvoice = subscription.latest_invoice;
  const latestInvoiceExpanded =
    typeof latestInvoice === "object" &&
    latestInvoice &&
    !("deleted" in latestInvoice)
      ? (latestInvoice as InvoiceWithPaymentIntent)
      : null;

  const paymentIntent =
    latestInvoiceExpanded &&
    latestInvoiceExpanded.payment_intent &&
    typeof latestInvoiceExpanded.payment_intent === "object"
      ? latestInvoiceExpanded.payment_intent
      : null;

  const setupSecret =
    pendingSetupIntent &&
    typeof pendingSetupIntent === "object" &&
    typeof pendingSetupIntent.client_secret === "string"
      ? pendingSetupIntent.client_secret
      : null;

  const paymentSecret =
    paymentIntent && typeof paymentIntent.client_secret === "string"
      ? paymentIntent.client_secret
      : null;

  if (setupSecret) {
    return { clientSecret: setupSecret, intentType: "setup" };
  }

  return { clientSecret: paymentSecret, intentType: "payment" };
}

async function getReusablePendingSubscription(args: {
  uid: string;
  plan: Plan;
  userData: UserBillingDoc | null;
}) {
  const stripe = getStripe();
  const pendingId =
    typeof args.userData?.stripePendingSubscriptionId === "string"
      ? args.userData.stripePendingSubscriptionId.trim()
      : "";
  if (!pendingId) return null;

  const pendingPlan =
    typeof args.userData?.stripePendingPlan === "string"
      ? args.userData.stripePendingPlan
      : "";
  if (pendingPlan !== args.plan) return null;

  try {
    const sub = await stripe.subscriptions.retrieve(pendingId);
    if (sub.metadata?.uid !== args.uid) return null;
    if (sub.metadata?.plan !== args.plan) return null;

    // Reuse only while still in pre-activation states.
    const reusable = new Set<Stripe.Subscription.Status>([
      "incomplete",
      "past_due",
    ]);
    if (!reusable.has(sub.status)) return null;

    return sub;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    // Authenticate user via Firebase ID token
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    const idToken = match?.[1];

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 },
      );
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? undefined;

    const body = (await req.json()) as { plan?: Plan; discountCode?: string };
    const plan = body.plan;

    if (!plan || (plan !== "MONTHLY" && plan !== "ANNUAL")) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe price ID env var" },
        { status: 500 },
      );
    }

    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      return NextResponse.json(
        { error: "Missing Stripe publishable key env var" },
        { status: 500 },
      );
    }

    const discountCode = normalizeCode(body.discountCode);

    const { customerId, userRef, userData } = await ensureCustomer(uid, email);

    const discount = discountCode
      ? await resolveDiscount(discountCode)
      : null;

    if (discountCode && !discount) {
      return NextResponse.json(
        { error: "Invalid or inactive discount code" },
        { status: 400 },
      );
    }

    const reusablePending = await getReusablePendingSubscription({
      uid,
      plan,
      userData,
    });

    const subscription = reusablePending
      ? reusablePending
      : await stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: priceId, quantity: 1 }],
            payment_behavior: "default_incomplete",
            payment_settings: {
              save_default_payment_method: "on_subscription",
              payment_method_types: ["card"],
            },
            discounts: discount ? [discount] : undefined,
            metadata: {
              uid,
              plan,
              discountCode: discountCode ?? "",
            },
          },
          {
            // Prevent duplicate subscriptions on retries / rapid repeated clicks.
            idempotencyKey: hashIdempotencyKey(
              [
                uid,
                plan,
                discountCode ?? "none",
                req.headers.get("idempotency-key") ?? "",
                String(Math.floor(Date.now() / 60_000)),
              ].join(":"),
            ),
          },
        );

    const intent = await getCheckoutIntentFromSubscription(subscription.id);

    if (!intent.clientSecret) {
      return NextResponse.json(
        { error: "Unable to initialize payment details" },
        { status: 500 },
      );
    }

    await userRef.set(
      {
        stripePendingSubscriptionId: subscription.id,
        stripePendingPlan: plan,
        stripePendingDiscountCode: discountCode ?? null,
        stripePendingUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return NextResponse.json({
      publishableKey,
      clientSecret: intent.clientSecret,
      intentType: intent.intentType,
      subscriptionId: subscription.id,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Checkout creation failed";
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
