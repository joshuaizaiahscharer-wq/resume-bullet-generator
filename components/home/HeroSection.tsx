import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          AI-Powered Resume Tool
        </span>

        <h1 className="mt-6 max-w-4xl text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Transform Your Resume Into
          <span className="text-primary"> Interview Magnets</span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Turn basic job descriptions into powerful, results-driven bullet points that get noticed by recruiters and pass ATS systems.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/resume-template-builder"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 sm:w-auto"
          >
            Generate Resume Bullets
          </Link>
          <Link
            href="/check-my-resume"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-border bg-card px-8 py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary sm:w-auto"
          >
            Check My Resume
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-4 md:mt-16">
          <div className="flex flex-col items-center rounded-xl border border-border bg-card/50 p-4 md:p-6">
            <span className="text-2xl font-bold text-foreground md:text-3xl">10K+</span>
            <span className="mt-1 text-xs text-muted-foreground md:text-sm">Bullets Generated</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-card/50 p-4 md:p-6">
            <span className="text-2xl font-bold text-foreground md:text-3xl">95%</span>
            <span className="mt-1 text-xs text-muted-foreground md:text-sm">ATS Pass Rate</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-card/50 p-4 md:p-6">
            <span className="text-2xl font-bold text-foreground md:text-3xl">3x</span>
            <span className="mt-1 text-xs text-muted-foreground md:text-sm">More Interviews</span>
          </div>
        </div>
      </div>
    </section>
  );
}
