// src/app/api/stripe/portal/route.ts
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

function resolveSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL in production environment");
  }

  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
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
    const user = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;

    const stripeCustomerId =
      typeof user?.stripeCustomerId === "string" ? user.stripeCustomerId : "";
    const stripeSubscriptionId =
      typeof user?.stripeSubscriptionId === "string" ? user.stripeSubscriptionId : "";

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer found for this user. Ensure stripeCustomerId is saved on users/{uid} (e.g. from checkout.session.completed).",
        },
        { status: 400 },
      );
    }

    // Security check: ensure the customer/subscription really belongs to this Firebase uid.
    let customerOwnedByUid = false;
    let subscriptionOwnedByUid = false;

    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (!("deleted" in customer) || !customer.deleted) {
        customerOwnedByUid = customer.metadata?.uid === uid;
      }
    } catch {
      customerOwnedByUid = false;
    }

    if (stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const subCustomerId =
          typeof sub.customer === "string"
            ? sub.customer
            : sub.customer?.id;
        subscriptionOwnedByUid =
          Boolean(subCustomerId && subCustomerId === stripeCustomerId) &&
          sub.metadata?.uid === uid;
      } catch {
        subscriptionOwnedByUid = false;
      }
    }

    if (!customerOwnedByUid && !subscriptionOwnedByUid) {
      return NextResponse.json(
        { error: "Stripe ownership check failed for this account." },
        { status: 403 },
      );
    }

    const siteUrl = resolveSiteUrl();

    // Return here after managing billing
    const returnUrl = `${siteUrl}/app/account`;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Portal session creation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
