import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const pages = [
  "bartender",
  "server",
  "customer-service",
  "sales-associate",
  "retail",
  "warehouse-worker",
  "line-cook",
  "cashier",
  "administrative-assistant",
  "receptionist",
  "marketing-assistant",
  "social-media-manager",
  "data-entry",
  "construction-worker",
  "delivery-driver",
  "security-guard",
  "cleaner",
  "housekeeper",
  "barista",
  "host-hostess",
  "no-experience",
  "entry-level",
  "student",
  "high-school",
  "college-student",
  "internship",
  "first-job",
  "career-change",
  "part-time-job",
  "seasonal-job",
  "how-to-write-resume-bullets",
  "resume-bullets-with-metrics",
  "strong-resume-bullet-examples",
  "resume-bullets-that-get-interviews",
  "improve-resume-bullets",
  "turn-duties-into-achievements",
  "resume-action-verbs-examples",
  "quantify-resume-experience",
  "fix-weak-resume-bullets",
  "resume-bullet-generator-free",
  "resume-bullet-examples-for-restaurant-jobs",
  "resume-bullets-for-customer-service-with-no-experience",
  "resume-bullets-for-sales-with-metrics",
  "resume-bullets-for-fast-food-workers",
  "resume-bullets-for-retail-with-achievements",
  "resume-bullets-for-students-first-job",
  "resume-bullets-for-warehouse-no-experience",
  "resume-bullets-for-admin-jobs-entry-level",
  "resume-bullets-for-marketing-internship",
  "resume-bullets-for-barista-no-experience",
] as const;

type PageSlug = (typeof pages)[number];

type PageProps = {
  params: {
    slug: string;
  };
};

function formatSlug(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildExampleBullets(slug: string): string[] {
  const role = formatSlug(slug).toLowerCase();

  const templates = [
    `Increased team productivity by 22% by redesigning daily workflows for ${role} responsibilities and reducing handoff delays.`,
    `Improved customer satisfaction scores by 18% by applying proactive communication and faster issue resolution in ${role} tasks.`,
    `Reduced processing errors by 31% by introducing a quality checklist and auditing high-volume ${role} outputs weekly.`,
    `Generated $14K in additional monthly revenue by identifying upsell opportunities and improving service consistency.`,
    `Completed 120+ weekly tasks with 99% accuracy while maintaining on-time delivery standards in a fast-paced environment.`,
    `Cut training ramp-up time by 35% by creating SOP documentation and coaching 6 new team members.`,
    `Exceeded KPI targets by 19% for 4 consecutive quarters through data-driven prioritization and performance tracking.`,
    `Streamlined reporting cycles by 40% by automating recurring updates and standardizing templates across stakeholders.`,
    `Resolved 45+ weekly customer requests while keeping average response time under 2 hours and CSAT above 95%.`,
    `Lowered operating costs by $9,500 annually by improving inventory usage, reducing waste, and negotiating supplier terms.`,
    `Boosted conversion rate by 16% through stronger discovery questions, objection handling, and tailored recommendations.`,
    `Coordinated cross-functional projects that delivered milestones 2 weeks early and improved delivery consistency by 27%.`,
    `Maintained compliance at 100% across internal audits by enforcing documentation standards and process controls.`,
    `Achieved a 28% increase in repeat business by elevating service quality and follow-up cadence.`,
    `Managed high-volume operations during peak periods with zero critical incidents across 9 straight months.`,
  ];

  return templates.slice(0, 12);
}

function getTips(slug: string): string[] {
  const role = formatSlug(slug).toLowerCase();
  return [
    `Lead each ${role} bullet with a strong action verb like "Increased," "Improved," or "Reduced."`,
    "Add measurable impact using percentages, dollar amounts, time saved, or volume handled.",
    "Turn duties into achievements by describing outcomes, not only responsibilities.",
    "Match keywords from the job description so your resume bullets align with ATS filters.",
    "Keep each bullet concise, specific, and focused on one result-oriented accomplishment.",
  ];
}

function getRelatedSlugs(currentSlug: string): PageSlug[] {
  const currentIdx = pages.indexOf(currentSlug as PageSlug);
  const start = currentIdx >= 0 ? currentIdx : 0;

  const related: PageSlug[] = [];
  for (let i = 1; i <= pages.length && related.length < 5; i += 1) {
    const candidate = pages[(start + i) % pages.length];
    if (candidate !== currentSlug) {
      related.push(candidate);
    }
  }

  return related;
}

export async function generateStaticParams() {
  return pages.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!pages.includes(params.slug as PageSlug)) {
    return {
      title: "Page Not Found | MyResumeBullets",
      description: "The requested resume bullet example page could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const formatted = params.slug.replace(/-/g, " ");
  const title = `Resume Bullet Examples for ${formatted}`;
  const description = `Generate strong resume bullet points for ${formatted} with real examples and metrics.`;
  const url = `https://myresumebullets.com/resume-bullets/${params.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "MyResumeBullets",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ResumeBulletsSlugPage({ params }: PageProps) {
  const { slug } = params;

  if (!pages.includes(slug as PageSlug)) {
    notFound();
  }

  const formattedSlug = formatSlug(slug);
  const bullets = buildExampleBullets(slug);
  const tips = getTips(slug);
  const relatedSlugs = getRelatedSlugs(slug);

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg backdrop-blur sm:p-8">
          <p className="mb-3 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
            SEO Resume Guide
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Resume Bullet Examples for {formattedSlug}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Learn how to write strong, achievement-focused resume bullets for {formattedSlug}. Use these examples to
            turn daily responsibilities into measurable results that improve ATS performance and help you get more
            interviews.
          </p>
        </header>

        <section className="mb-10" aria-labelledby="example-bullets-heading">
          <h2 id="example-bullets-heading" className="mb-4 text-2xl font-semibold text-white">
            Example Resume Bullets for {formattedSlug}
          </h2>
          <ul className="grid gap-3 sm:gap-4" aria-label={`Resume bullet examples for ${formattedSlug}`}>
            {bullets.map((bullet, index) => (
              <li
                key={`${slug}-bullet-${index}`}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200 shadow-sm sm:text-base"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg" aria-labelledby="tool-heading">
          <h2 id="tool-heading" className="text-2xl font-semibold text-white">
            Try the MyResumeBullets Generator
          </h2>
          <p className="mt-3 text-slate-300">
            Paste your job title and create resume bullets with action verbs, metrics, and role-specific keywords in
            seconds.
          </p>
          <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" action="#" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="jobTitle" className="sr-only">
              Job title
            </label>
            <input
              id="jobTitle"
              type="text"
              placeholder={`e.g. ${formattedSlug}`}
              className="w-full rounded-xl border border-slate-700 bg-black px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              Generate Bullets
            </button>
          </form>
        </section>

        <section className="mb-10" aria-labelledby="tips-heading">
          <h2 id="tips-heading" className="mb-4 text-2xl font-semibold text-white">
            Tips to Improve Resume Bullets
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-slate-300">
            {tips.map((tip, index) => (
              <li key={`${slug}-tip-${index}`} className="leading-7">
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <nav aria-labelledby="related-pages-heading" className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg">
          <h2 id="related-pages-heading" className="mb-4 text-2xl font-semibold text-white">
            Related Resume Bullet Pages
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedSlugs.map((relatedSlug) => (
              <li key={relatedSlug}>
                <Link
                  href={`/resume-bullets/${relatedSlug}`}
                  className="inline-flex text-blue-300 hover:text-blue-200 hover:underline"
                >
                  Resume Bullet Examples for {formatSlug(relatedSlug)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
