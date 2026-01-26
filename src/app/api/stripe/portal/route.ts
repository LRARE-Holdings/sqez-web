import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { cert, getApps, initializeApp } from "firebase-admin/app";

// Ensure Firebase Admin is initialised exactly once.
// Supports either default credentials (e.g. GCP) or a JSON service account in env.
if (!getApps().length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (svc) {
    // FIREBASE_SERVICE_ACCOUNT_KEY should be the full JSON (often stored as a single-line string)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const serviceAccount = JSON.parse(svc);
    initializeApp({ credential: cert(serviceAccount as object) });
  } else {
    // Falls back to Application Default Credentials
    initializeApp();
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: NextRequest) {
  try {
    /* -----------------------------
       🔐 Authenticate user
       ----------------------------- */
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 },
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    /* -----------------------------
       📦 Load user + Stripe ID
       ----------------------------- */
    const db = getFirestore();
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User record not found" },
        { status: 404 },
      );
    }

    const { stripeCustomerId } = userSnap.data() as {
      stripeCustomerId?: string;
    };

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer on file" },
        { status: 400 },
      );
    }

    /* -----------------------------
       🔁 Parse return URL
       ----------------------------- */
    const { returnUrl } = (await req.json()) as {
      returnUrl?: string;
    };

    if (!returnUrl) {
      return NextResponse.json(
        { error: "Missing returnUrl" },
        { status: 400 },
      );
    }

    /* -----------------------------
       💳 Create portal session
       ----------------------------- */
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe portal error:", err);

    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}