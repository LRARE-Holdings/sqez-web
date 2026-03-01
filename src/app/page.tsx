import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Reveal } from "@/components/marketing/Reveal";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const TRUSTED_INSTITUTIONS = [
  {
    name: "BPP University",
    logo: "/institutions/bpp-university.svg",
    width: 220,
  },
  {
    name: "Newcastle Univesity",
    logo: "/institutions/newcastle-university.svg",
    width: 320,
  },
  {
    name: "University College London",
    logo: "/institutions/university-college-london.svg",
    width: 360,
  },
  {
    name: "University of Northumbria",
    logo: "/institutions/northumbria.svg",
    width: 440,
  },
  {
    name: "University of Manchester",
    logo: "/institutions/university-of-manchester.svg",
    width: 360,
  },
  {
    name: "University of Leeds",
    logo: "/institutions/university-of-leeds.svg",
    width: 300,
  },
  {
    name: "University of Oxford",
    logo: "/institutions/university-of-oxford.svg",
    width: 360,
  },
    {
    name: "King's College London",
    logo: "/institutions/kings-college-london.svg",
    width: 360,
  },
      {
    name: "The University of Law",
    logo: "/institutions/uni-of-law.svg",
    width: 360,
  },
] as const;

function Divider() {
  return <div className="mkt-divider" aria-hidden="true" />;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label="SQEz home">
      <Image
        src="/sqez-logo.svg"
        alt="SQEz"
        width={132}
        height={38}
        className="h-5 w-auto sm:h-6"
        priority
        unoptimized
      />
    </Link>
  );
}

function ProgressRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="mkt-progress-wrap">
      <div className="mkt-progress-ring" aria-label={`Progress ${clamped}%`} role="img">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(234, 234, 234, 0.16)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(234, 234, 234, 0.92)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="mkt-progress-value">{clamped}%</div>
      </div>

      <div>
        <div className="mkt-kicker">Session health</div>
        <div className="mkt-progress-label">On track today</div>
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
    <article className="mkt-glass-soft mkt-interactive mkt-stat-card">
      <div className="mkt-kicker">{label}</div>
      <div className="mkt-stat-value">{value}</div>
      <div className="mkt-stat-hint">{hint}</div>
    </article>
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
    <article className="mkt-glass-soft mkt-interactive mkt-step-card">
      <div className="mkt-step-num">{number}</div>
      <div>
        <h3 className="mkt-step-title">{title}</h3>
        <p className="mkt-step-desc">{desc}</p>
      </div>
    </article>
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
    <article className="mkt-glass-soft mkt-interactive mkt-feature-row">
      <h3 className="mkt-feature-title">{title}</h3>
      <p className="mkt-feature-desc">{desc}</p>
    </article>
  );
}

function TrustedByMarquee({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "mkt-trusted-wrap" : "mkt-section mkt-trusted-wrap"}
      aria-labelledby={compact ? undefined : "trusted-by-heading"}
    >
      {!compact ? (
        <div className="mkt-section-head">
          <div>
            <h2 id="trusted-by-heading" className="mkt-section-title">
              Trusted by students from
            </h2>
            <p className="mkt-section-copy">
              Universities and institutions where learners use SQEz.
            </p>
          </div>
          <div className="mkt-section-meta">Hover to pause</div>
        </div>
      ) : (
        <div className="mkt-trusted-caption">Used by students at</div>
      )}

      <div
        className={`mkt-trusted-marquee ${compact ? "mkt-trusted-marquee-compact" : ""}`}
        role="region"
        aria-label="Institutions where students have used SQEz"
      >
        <div className="mkt-trusted-track">
          {[false, true].map((isDuplicate) => (
            <div
              key={isDuplicate ? "duplicate" : "main"}
              className="mkt-trusted-group"
              aria-hidden={isDuplicate}
            >
              {TRUSTED_INSTITUTIONS.map((institution) => (
                <div
                  className="mkt-trusted-logo"
                  key={`${institution.name}-${isDuplicate ? "dup" : "main"}`}
                >
                  <Image
                    src={institution.logo}
                    alt={isDuplicate ? "" : institution.name}
                    width={institution.width}
                    height={64}
                    loading="lazy"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SessionCard() {
  return (
    <article className="mkt-glass mkt-session-card mkt-interactive">
      <div className="mkt-card-glow" aria-hidden="true" />
      <div className="mkt-session-layout">
        <div className="max-w-[34rem]">
          <div className="mkt-label mkt-label-live">
            <span className="mkt-label-dot" />
            Today&apos;s session
          </div>

          <h2 className="mkt-card-title">10 MCQs. One focused loop. No fluff.</h2>

          <p className="mkt-card-copy">
            Answer exam-standard questions, then use <span className="text-white">Autopsy Mode</span> to
            learn the rule, recognise the pattern, and move on, fast.
          </p>

          <div className="mkt-session-meta-grid">
            <div className="mkt-meta-card">
              <div className="mkt-kicker">Focus</div>
              <div className="mkt-meta-value">FLK1 • Contract</div>
            </div>
            <div className="mkt-meta-card">
              <div className="mkt-kicker">Time</div>
              <div className="mkt-meta-value">~12 minutes</div>
            </div>
          </div>
        </div>

        <ProgressRing value={62} />
      </div>

      <p className="mkt-session-note">SQEz is a companion tool. It is not a prep-course replacement.</p>
    </article>
  );
}

export default function HomePage() {
  return (
    <main className={`mkt-page ${inter.className}`}>
      <div className="mkt-bg" aria-hidden="true">
        <div className="mkt-vignette" />
        <div className="mkt-orb mkt-orb-a" />
        <div className="mkt-orb mkt-orb-b" />
        <div className="mkt-orb mkt-orb-c" />
        <div className="mkt-noise" />
      </div>

      <header className="mkt-header">
        <div className="mkt-shell mkt-header-inner">
          <Logo />

          <div className="flex items-center gap-2">
            <Link href="/auth" className="mkt-btn mkt-btn-ghost">
              Sign in
            </Link>
            <Link href="/signup?next=%2Fonboarding" className="mkt-btn mkt-btn-primary hidden sm:inline-flex">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div className="mkt-content">
        <section className="mkt-hero">
          <div className="mkt-shell mkt-hero-shell">
            <Reveal className="mkt-hero-main">
              <p className="mkt-hero-meta">
                Exam-standard MCQs
                <span aria-hidden="true">•</span>
                Autopsy Mode
                <span aria-hidden="true">•</span>
                Confidence tracking
                <span aria-hidden="true">•</span>
                Built for short sessions
              </p>

              <h1 className="mkt-title">
                Master the <span className="font-bold">SQE</span>
              </h1>

              <p className="mkt-hero-copy">
                SQEz is the ultimate platform for aspiring solicitors and law students who want to
                master their solicitors&apos; qualifying exams.
              </p>

              <div className="mkt-cta-row">
                <Link href="/signup?next=%2Fonboarding" className="mkt-btn mkt-btn-primary mkt-btn-lg">
                  Get started today!
                </Link>
                <Link href="#how-it-works" className="mkt-btn mkt-btn-ghost mkt-btn-lg">
                  How it works
                </Link>
              </div>
            </Reveal>

            <Reveal delay={70} className="mkt-hero-slider">
              <TrustedByMarquee compact />
            </Reveal>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-shell">
            <Reveal delay={120}>
              <SessionCard />
            </Reveal>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-shell">
            <Reveal delay={170}>
              <div className="mkt-section-head">
                <div>
                  <h2 className="mkt-section-title">A dashboard you&apos;ll actually use</h2>
                  <p className="mkt-section-copy">Minimal. Calm. Designed to keep you moving.</p>
                </div>
                <div className="mkt-section-meta">Preview metrics (example)</div>
              </div>

              <div className="mkt-stat-grid">
                <StatCard label="Streak" value="5" hint="days" />
                <StatCard label="Accuracy" value="71%" hint="last 7 days" />
                <StatCard label="Confidence" value="+12" hint="net change" />
              </div>
            </Reveal>
          </div>
        </section>

        <div className="mkt-shell">
          <Divider />
        </div>

        <section className="mkt-section" id="pricing">
          <div className="mkt-shell">
            <Reveal delay={220}>
              <div className="mkt-section-head">
                <div>
                  <h2 className="mkt-section-title">Pricing</h2>
                  <p className="mkt-section-copy">One plan. Two ways to pay.</p>
                  <p className="mkt-fine-print">Prices shown are for the web. App Store pricing differs.</p>
                </div>
                <div className="mkt-section-meta">Cancel anytime</div>
              </div>

              <div className="mkt-pricing-grid">
                <article className="mkt-glass mkt-pricing-card mkt-pricing-primary mkt-interactive">
                  <div className="mkt-card-glow" aria-hidden="true" />
                  <div className="mkt-price-head">
                    <div>
                      <div className="mkt-label mkt-label-live">
                        <span className="mkt-label-dot" />
                        Best value
                      </div>
                      <h3 className="mkt-pricing-title">Annual</h3>
                      <p className="mkt-pricing-copy">Best value on the web. Save versus monthly.</p>
                    </div>

                    <div className="mkt-price-tag">
                      <div className="mkt-price-main">£99.99</div>
                      <div className="mkt-price-sub">per year</div>
                      <div className="mkt-price-note">
                        Equivalent <span className="font-semibold text-white">£8.33/mo</span>
                      </div>
                    </div>
                  </div>

                  <div className="mkt-save-box">
                    <div className="mkt-kicker">You save</div>
                    <div className="mkt-save-value">44.4% per year</div>
                    <div className="mkt-save-note">(vs £14.99/month billed monthly on the web)</div>
                  </div>

                  <ul className="mkt-bullet-list">
                    <li>Full MCQ access (SQE1 &amp; SQE2)</li>
                    <li>Autopsy Mode + confidence tracking</li>
                    <li>Progress + streaks across devices</li>
                  </ul>

                  <div className="mkt-cta-row mkt-cta-row-pricing">
                    <Link
                      href="/signup?next=%2Fonboarding"
                      className="mkt-btn mkt-btn-primary"
                      aria-label="Choose annual plan"
                    >
                      Choose annual
                    </Link>
                    <Link href="/auth" className="mkt-btn mkt-btn-ghost" aria-label="Sign in">
                      Sign in
                    </Link>
                  </div>
                </article>

                <article className="mkt-glass-soft mkt-pricing-card mkt-interactive">
                  <div className="mkt-price-head">
                    <div>
                      <div className="mkt-label">Most flexible</div>
                      <h3 className="mkt-pricing-title">Monthly</h3>
                      <p className="mkt-pricing-copy">Pay month-to-month.</p>
                    </div>

                    <div className="mkt-price-tag">
                      <div className="mkt-price-main">£14.99</div>
                      <div className="mkt-price-sub">per month</div>
                      <div className="mkt-price-note">£179.88/year if kept for 12 months</div>
                    </div>
                  </div>

                  <ul className="mkt-bullet-list">
                    <li>Same full access as annual</li>
                    <li>Great if you want maximum flexibility</li>
                    <li>Cancel anytime</li>
                  </ul>

                  <div className="mkt-cta-row mkt-cta-row-pricing">
                    <Link
                      href="/signup?next=%2Fonboarding"
                      className="mkt-btn mkt-btn-outline"
                      aria-label="Choose monthly plan"
                    >
                      Choose monthly
                    </Link>
                    <Link href="/auth" className="mkt-btn mkt-btn-ghost" aria-label="Sign in">
                      Sign in
                    </Link>
                  </div>

                  <p className="mkt-fine-print mkt-pricing-footnote">
                    Web annual saves you 44.4% if you&apos;d otherwise stay for a year.
                  </p>
                </article>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="mkt-shell">
          <Divider />
        </div>

        <section id="how-it-works" className="mkt-section scroll-mt-24">
          <div className="mkt-shell">
            <Reveal delay={260}>
              <h2 className="mkt-section-title">How SQEz works</h2>
              <p className="mkt-section-copy max-w-2xl">
                Built around short sessions and high-quality review.
                <br />
                No endless reading. No hype. Just repetition that sticks.
              </p>

              <div className="mkt-step-grid">
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
                  desc="Confidence isn't vibes. SQEz tracks it alongside accuracy, so you know what's real."
                />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-shell">
            <Reveal delay={310}>
              <div className="mkt-feature-grid">
                <FeatureRow
                  title="Autopsy Mode"
                  desc="A calm, structured post-answer review: why you chose it, why it's wrong, what the rule is, and how to recognise the pattern next time."
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
            </Reveal>
          </div>
        </section>

        <div className="mkt-shell">
          <Divider />
        </div>

        <section className="mkt-section mkt-cta-block">
          <div className="mkt-shell">
            <Reveal delay={340}>
              <div className="mkt-glass-soft mkt-final-cta">
                <h2 className="mkt-section-title">Ready for today&apos;s session?</h2>
                <p className="mkt-section-copy">Start now. Keep it small. Keep it consistent.</p>

                <div className="mkt-cta-row mkt-cta-row-final">
                  <Link href="/signup?next=%2Fonboarding" className="mkt-btn mkt-btn-final-primary">
                    Get started
                  </Link>
                  <Link href="/auth" className="mkt-btn mkt-btn-final-secondary">
                    Sign in
                  </Link>
                </div>

                <p className="mkt-fine-print mt-3">Prefer iOS? SQEz is now available on the App Store.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <footer className="mkt-footer">
          <div className="mkt-shell mkt-footer-inner">
            <div>© {new Date().getFullYear()} LRARE Holdings Ltd</div>

            <div className="mkt-footer-links">
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

            <div className="mkt-footnote">
              SQEz is a revision companion tool. Always cross-check with official materials and your
              chosen course provider.
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
