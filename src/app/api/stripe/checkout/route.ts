import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

type Plan = "MONTHLY" | "ANNUAL";

function priceIdForPlan(plan: Plan) {
  if (plan === "MONTHLY") return process.env.STRIPE_PRICE_WEB_MONTHLY;
  return process.env.STRIPE_PRICE_WEB_ANNUAL;
}

function trialDaysForPlan(plan: Plan): number {
  return plan === "MONTHLY" ? 14 : 30;
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
    const body = (await req.json()) as { plan?: Plan };
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

    const trialDays = trialDaysForPlan(plan);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // 💳 Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [{ price: priceId, quantity: 1 }],

      // Prefill email if available (Stripe will still create the Customer automatically)
      customer_email: email,

      // ✅ Force card collection up-front, even though today is £0 (trial)
      payment_method_collection: "always",

      // ✅ Free trial setup (per plan)
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { uid, plan },
      },

      success_url: `${siteUrl}/app/upgrade?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/onboarding/plan?checkout=cancel`,

      metadata: { uid, plan },

      // ✅ Allow users to enter Stripe promo codes / coupons at checkout
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Checkout creation failed" },
      { status: 500 },
    );
  }
}