import type { User } from "firebase/auth";
import { multiFactor } from "firebase/auth";

export function isPasswordUser(user: User) {
  return user.providerData.some((p) => p.providerId === "password");
}

export function needsMfaEnrollment(user: User) {
  // Only enforce for password users; skip for Google/Apple
  if (!isPasswordUser(user)) return false;

  const enrolled = multiFactor(user).enrolledFactors ?? [];
  return enrolled.length === 0;
}