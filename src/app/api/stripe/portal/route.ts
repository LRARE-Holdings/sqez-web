// src/app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  try {
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

    const db = adminDb();
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? (userSnap.data() as any) : null;

    const stripeCustomerId =
      typeof user?.stripeCustomerId === "string" ? user.stripeCustomerId : "";

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer found for this user. Ensure stripeCustomerId is saved on users/{uid} (e.g. from checkout.session.completed).",
        },
        { status: 400 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Return here after managing billing
    const returnUrl = `${siteUrl}/app/account`;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Portal session creation failed" },
      { status: 500 },
    );
  }
}