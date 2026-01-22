import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var.");
  }

  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert(serviceAccount),
  });
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}

export function adminDb() {
  initAdmin();
  return getFirestore();
}