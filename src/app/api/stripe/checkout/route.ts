import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

type Plan = "MONTHLY" | "ANNUAL";
type InvoiceWithPaymentIntent = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null;
};

function priceIdForPlan(plan: Plan) {
  if (plan === "MONTHLY") return process.env.STRIPE_PRICE_WEB_MONTHLY;
  return process.env.STRIPE_PRICE_WEB_ANNUAL;
}

function trialDaysForPlan(plan: Plan): number {
  return plan === "MONTHLY" ? 14 : 30;
}

function normalizeCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  return trimmed ? trimmed : null;
}

async function resolveDiscount(code: string) {
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
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : null;

  const existingId =
    typeof userData?.stripeCustomerId === "string"
      ? userData.stripeCustomerId.trim()
      : "";

  if (existingId) {
    try {
      const existing = await stripe.customers.retrieve(existingId);
      if (!("deleted" in existing)) {
        return existing.id;
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

  return created.id;
}

export async function POST(req: Request) {
  try {
    // 🔐 Authenticate user via Firebase ID token
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

    // 📦 Parse request body
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

    const trialDays = trialDaysForPlan(plan);
    const discountCode = normalizeCode(body.discountCode);

    const customerId = await ensureCustomer(uid, email);

    const discount = discountCode
      ? await resolveDiscount(discountCode)
      : null;

    if (discountCode && !discount) {
      return NextResponse.json(
        { error: "Invalid or inactive discount code" },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity: 1 }],
      trial_period_days: trialDays,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      discounts: discount ? [discount] : undefined,
      metadata: { uid, plan },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    });

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

    const clientSecret =
      (pendingSetupIntent &&
      typeof pendingSetupIntent === "object" &&
      typeof pendingSetupIntent.client_secret === "string"
        ? pendingSetupIntent.client_secret
        : null) ||
      (paymentIntent && typeof paymentIntent.client_secret === "string"
        ? paymentIntent.client_secret
        : null);

    const intentType: "setup" | "payment" =
      pendingSetupIntent &&
      typeof pendingSetupIntent === "object" &&
      typeof pendingSetupIntent.client_secret === "string"
        ? "setup"
        : "payment";

    if (!clientSecret) {
      return NextResponse.json(
        { error: "Unable to initialize payment details" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      publishableKey,
      clientSecret,
      intentType,
      subscriptionId: subscription.id,
      trialDays,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout creation failed";
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
