import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | BulletAI",
  description: "Learn about BulletAI, how it works, and the principles behind our resume optimization tools.",
};

const principles = [
  {
    title: "Outcome-Focused Writing",
    description:
      "We help transform task-based resume lines into achievement-driven bullets with clear business impact.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "Speed Without Guesswork",
    description:
      "You should be able to get useful feedback and improved copy in minutes, not after hours of editing.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Recruiter-Friendly Output",
    description:
      "Every suggestion is designed to stay clear, concise, and readable for both ATS systems and hiring teams.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const helpItems = [
  "Analyze resumes for structure, readability, and relevance",
  "Identify the biggest gaps that weaken interview conversion",
  "Rewrite content with stronger verbs, metrics, and outcomes",
  "Generate polished copy you can tailor to target roles quickly",
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 md:space-y-16">
      {/* Hero */}
      <header className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          About BulletAI
        </span>
        <h1 className="mt-6 max-w-3xl text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Built to Make Resumes Stronger
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          BulletAI is a resume optimization platform focused on one goal: helping job seekers communicate value with clarity. Our tools analyze structure, language, and impact so you can move from vague responsibilities to measurable achievements.
        </p>
      </header>

      {/* Principles */}
      <section className="grid gap-6 md:grid-cols-3">
        {principles.map((item) => (
          <article key={item.title} className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {item.icon}
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </section>

      {/* How it helps */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">How BulletAI Helps</h2>
        <ul className="mt-6 space-y-3">
          {helpItems.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Who it&apos;s for */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Who It&apos;s For</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          BulletAI is designed for students, early-career professionals, and experienced candidates who want clearer, more competitive resume content. Whether you&apos;re preparing your first application or updating for a career move, the goal is the same: show impact in a way recruiters can scan fast.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/check-my-resume"
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Try Check My Resume
          </Link>
          <Link
            href="/"
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}
