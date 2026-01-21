import Link from "next/link";

export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  children,
  backHref,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-white/60">
              Step {step} of {total}
            </div>
            {backHref ? (
              <Link href={backHref} className="text-xs text-white/60 hover:text-white/80">
                Back
              </Link>
            ) : null}
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-2 text-sm text-white/70 leading-relaxed">{subtitle}</p>
          ) : null}

          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function OptionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm text-white/90 hover:bg-white/10 transition"
      onClick={onClick}
    >
      {children}
    </button>
  );
}