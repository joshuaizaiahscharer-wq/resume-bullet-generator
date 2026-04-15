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
  params: Promise<{
    slug: string;
  }>;
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
  ];

  return templates;
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
  const { slug } = await params;
  
  if (!pages.includes(slug as PageSlug)) {
    return {
      title: "Page Not Found | MyResumeBullets",
      description: "The requested resume bullet example page could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const formatted = slug.replace(/-/g, " ");
  const title = `Resume Bullet Examples for ${formatted}`;
  const description = `Generate strong resume bullet points for ${formatted} with real examples and metrics.`;
  const url = `https://www.myresumebullets.com/resume-bullets/${slug}`;

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

export default async function ResumeBulletsSlugPage({ params }: PageProps) {
  const { slug } = await params;

  if (!pages.includes(slug as PageSlug)) {
    notFound();
  }

  const formattedSlug = formatSlug(slug);
  const bullets = buildExampleBullets(slug);
  const tips = getTips(slug);
  const relatedSlugs = getRelatedSlugs(slug);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {/* Header */}
      <header className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          Resume Guide
        </span>
        <h1 className="mt-4 max-w-3xl text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          Resume Bullet Examples for {formattedSlug}
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          Learn how to write strong, achievement-focused resume bullets for {formattedSlug}. Use these examples to turn daily responsibilities into measurable results.
        </p>
      </header>

      {/* Example Bullets */}
      <section aria-labelledby="example-bullets-heading">
        <h2 id="example-bullets-heading" className="text-xl font-bold text-foreground md:text-2xl">
          Example Resume Bullets
        </h2>
        <ul className="mt-5 grid gap-3" aria-label={`Resume bullet examples for ${formattedSlug}`}>
          {bullets.map((bullet, index) => (
            <li
              key={`${slug}-bullet-${index}`}
              className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground transition-colors hover:border-primary/30 md:text-base"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </section>

      {/* Generator Tool */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8" aria-labelledby="tool-heading">
        <h2 id="tool-heading" className="text-xl font-bold text-foreground md:text-2xl">
          Try the BulletAI Generator
        </h2>
        <p className="mt-3 text-muted-foreground">
          Create resume bullets with action verbs, metrics, and role-specific keywords in seconds.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="jobTitle" className="sr-only">
            Job title
          </label>
          <input
            id="jobTitle"
            type="text"
            placeholder={`e.g. ${formattedSlug}`}
            className="flex-1 rounded-xl border border-border bg-input px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Link
            href="/resume-template-builder"
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Generate Bullets
          </Link>
        </div>
      </section>

      {/* Tips */}
      <section aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="text-xl font-bold text-foreground md:text-2xl">
          Tips to Improve Your Bullets
        </h2>
        <ul className="mt-5 space-y-3">
          {tips.map((tip, index) => (
            <li key={`${slug}-tip-${index}`} className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Related Pages */}
      <nav aria-labelledby="related-pages-heading" className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 id="related-pages-heading" className="text-xl font-bold text-foreground md:text-2xl">
          Related Resume Guides
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {relatedSlugs.map((relatedSlug) => (
            <li key={relatedSlug}>
              <Link
                href={`/resume-bullets/${relatedSlug}`}
                className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
              >
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {formatSlug(relatedSlug)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
