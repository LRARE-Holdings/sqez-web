import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing webhook secret/signature" }, { status: 400 });
  }

  const body = await req.text(); // raw body required

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  try {
    // We care about subscription becoming active and payments succeeding
    if (
      event.type === "checkout.session.completed" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const obj: any = event.data.object;

      // Try to pull uid from metadata (preferred)
      const uid: string | undefined =
        obj?.metadata?.uid ||
        obj?.subscription_details?.metadata?.uid ||
        obj?.subscription?.metadata?.uid;

      const plan: string | undefined =
        obj?.metadata?.plan ||
        obj?.subscription_details?.metadata?.plan ||
        obj?.subscription?.metadata?.plan;

      if (uid) {
        const db = adminDb();

        // Standard subscription doc path you already use
        const ref = db.doc(`users/${uid}/subscription/current`);

        await ref.set(
          {
            isPro: true,
            tier: "pro",
            billing: plan ? `stripe_web_${String(plan).toLowerCase()}` : "stripe_web",
            updatedAt: new Date(),
            // Optional useful fields:
            stripe: {
              event: event.type,
              customerId: obj?.customer ?? null,
              subscriptionId: obj?.subscription ?? obj?.id ?? null,
            },
          },
          { merge: true },
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Webhook handler failed" }, { status: 500 });
  }
}