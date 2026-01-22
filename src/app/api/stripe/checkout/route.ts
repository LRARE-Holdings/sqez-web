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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    const idToken = match?.[1];

    if (!idToken) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = (await req.json()) as { plan?: Plan };
    const plan = body.plan;

    if (!plan || (plan !== "MONTHLY" && plan !== "ANNUAL")) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return NextResponse.json({ error: "Missing Stripe price ID env var" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/app/upgrade?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/onboarding/plan?checkout=cancel`,
      metadata: { uid, plan },
      subscription_data: {
        metadata: { uid, plan },
      },
      allow_promotion_codes: false,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Checkout creation failed" },
      { status: 500 },
    );
  }
}