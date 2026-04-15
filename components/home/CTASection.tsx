import Link from "next/link";

export function CTASection() {
  return (
    <section id="cta" className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Ready to Transform Your Resume?
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Stop guessing which resume bullets sound strong. Generate recruiter-ready lines, tailor them to your role, and apply with confidence.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/resume-template-builder"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 sm:w-auto"
          >
            Generate Resume Bullets
          </Link>
          <Link
            href="/blog"
            className="flex min-h-[48px] w-full items-center justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:w-auto"
          >
            Read Resume Tips
            <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
