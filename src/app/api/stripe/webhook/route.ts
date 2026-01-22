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

      const db = adminDb();

      // Resolve subscription id (where available)
      const subscriptionId: string | undefined =
        obj?.subscription ||
        (obj?.id && (event.type.startsWith("customer.subscription.") ? obj.id : undefined));

      // Resolve uid + plan from metadata. Preferred source is subscription metadata.
      let uid: string | undefined =
        obj?.metadata?.uid ||
        obj?.subscription_details?.metadata?.uid ||
        obj?.subscription?.metadata?.uid;

      let plan: string | undefined =
        obj?.metadata?.plan ||
        obj?.subscription_details?.metadata?.plan ||
        obj?.subscription?.metadata?.plan;

      // If this is an invoice, uid/plan are usually stored on the subscription metadata.
      // Fetch the subscription once if needed.
      if ((!uid || !plan) && subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          uid = uid || (sub.metadata?.uid as string | undefined);
          plan = plan || (sub.metadata?.plan as string | undefined);
        } catch {
          // ignore subscription lookup failures; we'll still proceed if uid is present
        }
      }

      if (uid) {
        const tier =
          String(plan || "")
            .trim()
            .toUpperCase() === "ANNUAL"
            ? "pro_web_annual"
            : "pro_web_monthly";

        const lastTxn =
          (typeof obj?.id === "string" && obj.id) ||
          (typeof obj?.payment_intent === "string" && obj.payment_intent) ||
          (typeof obj?.latest_invoice === "string" && obj.latest_invoice) ||
          (typeof obj?.invoice === "string" && obj.invoice) ||
          event.id;

        // Canonical user doc schema: write entitlement fields at users/{uid}
        const userRef = db.doc(`users/${uid}`);

        await userRef.set(
          {
            isPro: true,
            subscriptionTier: tier,
            proUpdatedAt: new Date(),
            lastTransactionID: String(lastTxn),
            updatedAt: new Date(),
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