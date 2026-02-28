import { redirect } from "next/navigation";

export default async function LegacyUpgradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const usp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) usp.append(key, v);
      continue;
    }
    if (typeof value === "string") usp.set(key, value);
  }

  const q = usp.toString();
  redirect(q ? `/checkout?${q}` : "/checkout");
}
