import Link from "next/link";

function Divider() {
  return <div className="divider my-10" aria-hidden="true" />;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="SQEz home">
      <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
      <span className="sr-only">SQEz</span>
    </Link>
  );
}

function ProgressRing({ value }: { value: number }) {
  const size = 44;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative" aria-label={`Progress ${clamped}%`} role="img">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(234,234,234,0.18)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(234,234,234,0.9)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
          {clamped}%
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="text-xs text-white/70">Session health</div>
        <div className="text-sm font-medium text-white">On track today</div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-soft">
      <div className="text-xs text-white/70">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-xs text-white/70">{hint}</div>
    </div>
  );
}

function HowItWorksStep({
  number,
  title,
  desc,
}: {
  number: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white">
          {number}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/80">
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="card-soft">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/80">{desc}</div>
    </div>
  );
}

function SessionCard() {
  return (
    <div className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[34rem]">
          <div className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Today’s session
          </div>

          <h2 className="mt-3 text-lg font-semibold tracking-tight text-white sm:text-xl">
            10 MCQs. One focused loop. No fluff.
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-white/80">
            Answer exam-standard questions, then use{" "}
            <span className="text-white">Autopsy Mode</span> to learn the rule,
            recognise the pattern, and move on, fast.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3">
              <div className="text-xs text-white/70">Focus</div>
              <div className="mt-1 text-sm font-medium text-white">
                FLK1 • Contract
              </div>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-3">
              <div className="text-xs text-white/70">Time</div>
              <div className="mt-1 text-sm font-medium text-white">
                ~12 minutes
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start sm:justify-end">
          <ProgressRing value={62} />
        </div>
      </div>


      <div className="mt-3 text-xs leading-relaxed text-white/70">
        SQEz is a companion tool. It is not a prep-course replacement.
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="relative min-h-dvh">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "#0a1a2f" }}
        />
        <div className="absolute -top-24 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo />
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth" className="btn btn-ghost px-3 py-2">
              Sign in
            </Link>
            <Link
              href="/signup?next=%2Fonboarding"
              className="btn btn-primary hidden px-3 py-2 sm:inline-flex"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full px-4 pb-14 pt-10">
        {/* Hero */}
        <section>
          <div className="container-sqez">
            <div className="flex flex-wrap gap-2">
              <span className="chip">Exam-standard MCQs</span>
              <span className="chip">Autopsy Mode</span>
              <span className="chip">Confidence tracking</span>
              <span className="chip">Built for short sessions</span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Ready?
              <span className="block text-white/85">Let's master the SQE.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              SQEz is the ultimate platform for aspiring solicitors and law students
              who want to master their solicitors' qualifying exams.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/signup?next=%2Fonboarding" className="btn btn-primary w-full sm:w-auto">
                Get started today!
              </Link>
              <Link href="#how-it-works" className="btn btn-ghost w-full sm:w-auto">
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* Main action card */}
        <section className="mt-8">
          <div className="container-sqez">
            <SessionCard />
          </div>
        </section>

        {/* Stats */}
        <section className="mt-10">
          <div className="container-sqez">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  A dashboard you’ll actually use
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Minimal. Calm. Designed to keep you moving.
                </p>
              </div>
              <div className="hidden sm:block text-xs text-white/60">
                Preview metrics (example)
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Streak" value="5" hint="days" />
              <StatCard label="Accuracy" value="71%" hint="last 7 days" />
              <StatCard label="Confidence" value="+12" hint="net change" />
            </div>
          </div>
        </section>

        <div className="container-sqez">
          <Divider />
        </div>

        {/* Pricing */}
        <section className="mt-10" id="pricing">
          <div className="container-sqez">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Pricing
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                  One plan. Two ways to pay.
                </p>
                <p className="mt-1 text-xs text-white/60">
                  Prices shown are for the web. App Store pricing differs.
                </p>
              </div>
              <div className="hidden sm:block text-xs text-white/60">
                Cancel anytime
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {/* Annual (preferred) */}
              <div className="card relative overflow-hidden">
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden="true"
                >
                  <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-white/6 blur-3xl" />
                </div>

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="chip">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Best value
                      </div>
                      <div className="mt-3 text-lg font-semibold tracking-tight text-white">
                        Annual
                      </div>
                      <div className="mt-1 text-sm text-white/80">
                        Best value on the web. Save versus monthly.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-semibold tracking-tight text-white">
                        £99.99
                      </div>
                      <div className="mt-1 text-xs text-white/70">per year</div>
                      <div className="mt-2 text-xs text-white/70">
                        Equivalent{" "}
                        <span className="font-medium text-white">£8.33/mo</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/12 bg-white/5 px-4 py-3">
                    <div className="text-xs text-white/70">You save</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      44.4% per year
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      (vs £14.99/month billed monthly on the web)
                    </div>
                  </div>

                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/80">
                    <li>Full MCQ access (SQE1 &amp; SQE2)</li>
                    <li>Autopsy Mode + confidence tracking</li>
                    <li>Progress + streaks across devices</li>
                  </ul>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href="/signup?next=%2Fonboarding"
                      className="btn btn-primary w-full sm:w-auto"
                      aria-label="Choose annual plan"
                    >
                      Choose annual
                    </Link>
                    <Link
                      href="/auth"
                      className="btn btn-ghost w-full sm:w-auto"
                      aria-label="Sign in"
                    >
                      Sign in
                    </Link>
                  </div>

                </div>
              </div>

              {/* Monthly */}
              <div className="card-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="chip">Monthly</div>
                    <div className="mt-3 text-lg font-semibold tracking-tight text-white">
                      Monthly
                    </div>
                    <div className="mt-1 text-sm text-white/80">
                      Pay month-to-month.
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-semibold tracking-tight text-white">
                      £14.99
                    </div>
                    <div className="mt-1 text-xs text-white/70">per month</div>
                    <div className="mt-2 text-xs text-white/60">
                      £179.88/year if kept for 12 months
                    </div>
                  </div>
                </div>

                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/80">
                  <li>Same full access as annual</li>
                  <li>Great if you want maximum flexibility</li>
                  <li>Cancel anytime</li>
                </ul>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/signup?next=%2Fonboarding"
                    className="btn btn-outline w-full sm:w-auto"
                    aria-label="Choose monthly plan"
                  >
                    Choose monthly
                  </Link>
                  <Link
                    href="/auth"
                    className="btn btn-ghost w-full sm:w-auto"
                    aria-label="Sign in"
                  >
                    Sign in
                  </Link>
                </div>

                <div className="mt-3 text-xs text-white/70">
                  Web annual saves you 44.4% if you’d otherwise stay for a year.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="container-sqez">
          <Divider />
        </div>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24">
          <div className="container-sqez">
            <h2 className="text-base font-semibold tracking-tight text-white">
              How SQEz works
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Built around short sessions and high-quality review. <br></br>No endless
              reading. No hype. Just repetition that sticks.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <HowItWorksStep
                number="1"
                title="Do the session"
                desc="A tight set of MCQs, tuned to your weaker areas and spaced repetition."
              />
              <HowItWorksStep
                number="2"
                title="Autopsy Mode"
                desc="Learn the rule, identify the trap, and store the pattern so you spot it next time."
              />
              <HowItWorksStep
                number="3"
                title="Track confidence"
                desc="Confidence isn’t vibes. SQEz tracks it alongside accuracy, so you know what’s real."
              />
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="mt-10">
          <div className="container-sqez grid gap-3">
            <FeatureRow
              title="Autopsy Mode"
              desc="A calm, structured post-answer review: why you chose it, why it’s wrong, what the rule is, and how to recognise the pattern next time."
            />
            <FeatureRow
              title="Designed for real life"
              desc="Short sessions, no guilt. Accessibility-first. Non-elitist by default. Built for undergrads, postgrads, apprentices, and career changers."
            />
            <FeatureRow
              title="Built by LRARE"
              desc="SQEz focuses on fairness, clarity, and outcomes over status and noise."
            />
          </div>
        </section>

        <div className="container-sqez">
          <Divider />
        </div>

        {/* CTA */}
        <section className="mt-10">
          <div className="container-sqez">
            <div className="card-soft px-5 py-5">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Ready for today’s session?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Start now. Keep it small. Keep it consistent.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/signup?next=%2Fonboarding" className="btn btn-primary w-full sm:w-auto">
                  Get started
                </Link>
                <Link href="/auth" className="btn btn-ghost w-full sm:w-auto">
                  Sign in
                </Link>
              </div>

              <div className="mt-3 text-xs leading-relaxed text-white/70">
                Prefer iOS? SQEz is now available on the App Store.
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-white/70">
          <div className="container-sqez px-4 text-center">
            <div>© {new Date().getFullYear()} LRARE Holdings Ltd</div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link className="hover:text-white" href="https://lrare.co.uk">
                Visit our main website
              </Link>
              <Link className="hover:text-white" href="https://lrare.co.uk/terms">
                Terms
              </Link>
              <Link className="hover:text-white" href="https://lrare.co.uk/privacy">
                Privacy
              </Link>
              <a
                className="hover:text-white"
                href="https://apps.apple.com/us/app/sqez/id6755055697"
                target="_blank"
                rel="noreferrer"
              >
                Download on iOS
              </a>
            </div>

            <div className="mt-3 text-[11px] leading-relaxed text-white/60">
              SQEz is a revision companion tool. Always cross-check with official
              materials and your chosen course provider.
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
