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
  },
  {
    title: "Speed Without Guesswork",
    description:
      "You should be able to get useful feedback and improved copy in minutes, not after hours of editing.",
  },
  {
    title: "Practical, Recruiter-Friendly Output",
    description:
      "Every suggestion is designed to stay clear, concise, and readable for both ATS systems and hiring teams.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <p className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
          About BulletAI
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Built to make resumes stronger</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          BulletAI is a resume optimization platform focused on one goal: helping job seekers communicate value with
          clarity. Our tools analyze structure, language, and impact so you can move from vague responsibilities to
          measurable achievements.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Core principles">
        {principles.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-800 bg-black/50 p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-blue-950/30 p-6 shadow-xl sm:p-8">
        <h2 className="text-2xl font-semibold text-white">How BulletAI Helps</h2>
        <ul className="mt-4 space-y-2 text-slate-200">
          <li>Analyze resumes for structure, readability, and relevance.</li>
          <li>Identify the biggest gaps that weaken interview conversion.</li>
          <li>Rewrite content with stronger verbs, metrics, and outcomes.</li>
          <li>Generate polished copy you can tailor to target roles quickly.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-2xl font-semibold text-white">Who It Is For</h2>
        <p className="mt-3 text-slate-300">
          BulletAI is designed for students, early-career professionals, and experienced candidates who want clearer,
          more competitive resume content. Whether you are preparing your first application or updating for a career
          move, the goal is the same: show impact in a way recruiters can scan fast.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/check-my-resume"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Try Check My Resume
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}