import Link from "next/link";

export default function RevisePage() {
  return (
    <div className="card">
      <div className="text-sm font-semibold text-white">Revise</div>
      <div className="mt-2 text-sm text-white/70">
        Quickfire and revision flows live here.
      </div>
      <div className="mt-5">
        <Link href="/app/session" className="btn btn-primary w-full sm:w-auto">
          Start Quickfire
        </Link>
      </div>
    </div>
  );
}