import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Resume Bullet Generator | Improve Your Resume Fast",
  description:
    "Generate powerful resume bullet points instantly with AI. Improve your resume and get more interviews today.",
  openGraph: {
    title: "AI Resume Bullet Generator | Improve Your Resume Fast",
    description:
      "Generate powerful resume bullet points instantly with AI. Improve your resume and get more interviews today.",
    url: "https://www.myresumebullets.com/",
    siteName: "MyResumeBullets",
    type: "website",
  },
  alternates: {
    canonical: "https://www.myresumebullets.com/",
  },
};

type Step = {
  title: string;
  description: string;
};

type Example = {
  before: string;
  after: string;
};

const howItWorksSteps: Step[] = [
  {
    title: "Enter Your Experience",
    description:
      "Paste your current role details, old bullet points, or raw job duties. You can be brief and messy; the tool is built to turn rough notes into polished resume language.",
  },
  {
    title: "Let AI Improve It",
    description:
      "Our AI Resume Bullet Generator rewrites each line with stronger verbs, clearer scope, and measurable outcomes so your resume reads like impact, not just tasks.",
  },
  {
    title: "Copy & Use Instantly",
    description:
      "Choose your favorite versions, copy in one click, and paste directly into your resume. Then tailor a little per role so every application stays targeted.",
  },
];

const beforeAfterExamples: Example[] = [
  {
    before: "Worked at a restaurant and took orders",
    after:
      "Managed high-volume order flow in a fast-paced restaurant environment, serving 100+ customers per shift while maintaining accuracy and efficiency",
  },
  {
    before: "Helped with social media posts",
    after:
      "Planned and published weekly social content calendar across Instagram and LinkedIn, improving average engagement by 34% over 90 days",
  },
  {
    before: "Answered customer emails",
    after:
      "Resolved 40+ customer inquiries per day via email and chat, maintaining a 96% satisfaction rating while reducing response time by 22%",
  },
];

const personas = [
  {
    title: "Students and New Graduates",
    copy: "Turn coursework, projects, internships, and campus leadership into resume bullet examples that show capability even when full-time experience is limited.",
  },
  {
    title: "Job Seekers Changing Roles",
    copy: "Translate transferable skills into ATS resume language so hiring teams can quickly see your relevance in a new industry or function.",
  },
  {
    title: "Experienced Professionals",
    copy: "Upgrade older bullets into concise, metric-driven statements that reflect strategic impact, ownership, and progression.",
  },
];

const features = [
  "Built for ATS resume readability with role-specific keyword guidance",
  "Generates multiple resume bullet examples for each experience line",
  "Prioritizes action verbs and quantifiable outcomes",
  "Supports broad industries from retail and hospitality to tech and healthcare",
  "Fast copy workflow designed for high-volume applications",
  "Keeps wording professional, concise, and recruiter-friendly",
];

const faqItems = [
  {
    question: "Is this tool free?",
    answer:
      "Yes. You can start generating improved resume bullets immediately and iterate as many times as needed while building your final resume.",
  },
  {
    question: "Does it help with ATS?",
    answer:
      "Yes. The generator is designed around ATS resume best practices like clear structure, action-focused phrasing, and keyword alignment with target job postings.",
  },
  {
    question: "Can I use it for any job?",
    answer:
      "Yes. It works across entry-level, mid-level, and senior roles. You can generate tailored resume bullet examples for nearly any job title.",
  },
];

function SectionWrap({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
        <div className="mt-5 space-y-4 text-slate-300">{children}</div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 px-6 py-12 md:px-10 md:py-16">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            AI Resume Bullet Generator That Gets You Interviews
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            Turn basic job experience into powerful, results-driven resume bullet points in seconds.
          </p>

          <ul className="mt-6 space-y-3 text-slate-200">
            <li>Optimized for ATS systems</li>
            <li>Designed to impress recruiters</li>
            <li>Built for students, job seekers, and professionals</li>
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/resume-template-builder"
              className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Generate My Resume Bullets
            </Link>
            <Link href="/blog" className="text-sm font-medium text-blue-300 hover:text-blue-200">
              Read Resume Guides
            </Link>
          </div>
        </div>
      </section>

      <SectionWrap id="how-it-works" title="How It Works">
        <div className="grid gap-4 md:grid-cols-3">
          {howItWorksSteps.map((step, idx) => (
            <article key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Step {idx + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{step.description}</p>
            </article>
          ))}
        </div>
      </SectionWrap>

      <SectionWrap id="what-is" title="What Is an AI Resume Bullet Generator">
        <p>
          An AI resume bullet generator is a writing assistant that transforms plain, responsibility-based job text into
          stronger achievement statements. Most people describe their work like a task list: answered emails, supported
          customers, helped with reports. Recruiters, however, evaluate impact. They want to see ownership, scope,
          quality, speed, and outcomes. This is where an AI resume bullet generator becomes valuable. Instead of spending
          hours rewriting each line, you can generate polished options quickly and focus your energy on tailoring for the
          role.
        </p>
        <p>
          The best part is speed plus consistency. A high-quality AI resume bullet generator helps you maintain a
          professional voice across all sections of your resume, not just one job entry. It can improve clarity, tighten
          phrasing, and encourage measurable language. This improves readability for both people and systems. In high-
          volume application funnels, that consistency matters because your resume may be scanned in seconds before a
          recruiter decides whether to keep reading.
        </p>
        <p>
          If you are comparing tools, look for one that supports ATS resume formatting, action verbs, and realistic
          metrics. You also want output that sounds human, role-relevant, and easy to customize. Good AI output should
          give you a strong first draft, not force you to rewrite everything from scratch.
        </p>
      </SectionWrap>

      <SectionWrap id="why-bullets-matter" title="Why Resume Bullets Matter">
        <p>
          Resume bullets are the center of your resume. Titles and company names provide context, but bullets provide
          proof. Strong bullets show what you did, how well you did it, and why it mattered. Weak bullets usually begin
          with vague language and end without outcomes. Strong bullets begin with clear verbs and often include numbers,
          timelines, volume, or quality improvements. This difference can directly affect interview rate.
        </p>
        <p>
          Recruiters often review many candidates for one role, so they scan for fast evidence. They are looking for
          relevant outcomes, aligned keywords, and clean formatting. This is why resume bullet examples built around
          impact are so effective. You do not need to overcomplicate your writing. You need to communicate results
          quickly. A practical bullet can say more in one sentence than a full paragraph of generic wording.
        </p>
        <p>
          Better bullets also support confidence. When your resume explains your value clearly, interview preparation
          becomes easier because your talking points are already organized. You can expand each bullet into stories during
          interviews. This creates continuity between application, interview, and final decision.
        </p>
      </SectionWrap>

      <SectionWrap id="before-after" title="Before vs After Examples">
        <div className="space-y-4">
          {beforeAfterExamples.map((example) => (
            <article key={example.before} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="text-lg font-semibold text-white">Example</h3>
              <p className="mt-3 text-slate-300">
                <span className="font-semibold text-slate-100">Before:</span> {example.before}
              </p>
              <p className="mt-2 text-slate-200">
                <span className="font-semibold text-blue-300">After:</span> {example.after}
              </p>
            </article>
          ))}
        </div>
      </SectionWrap>

      <SectionWrap id="who-its-for" title="Who It’s For">
        <div className="grid gap-4 md:grid-cols-3">
          {personas.map((persona) => (
            <article key={persona.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="text-lg font-semibold text-white">{persona.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{persona.copy}</p>
            </article>
          ))}
        </div>
        <p>
          Whether you are building your first resume or optimizing your tenth version, the same principles apply: focus
          on outcomes, align with the role, and keep language clear. Use this AI resume bullet generator to accelerate
          drafting, then personalize details with your real experience. That final personalization is what makes your
          application believable and competitive.
        </p>
      </SectionWrap>

      <SectionWrap id="features" title="Features">
        <ul className="list-disc space-y-2 pl-6">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </SectionWrap>

      <SectionWrap id="resume-tips" title="Resume Tips">
        <h3 className="text-lg font-semibold text-white">Use action verbs with specificity</h3>
        <p>
          Strong resume tips start with language quality. Begin each bullet with an action verb such as built, led,
          improved, streamlined, launched, or delivered. Then add context and a result. Instead of "responsible for
          onboarding," write "Built onboarding checklist for a 12-person team, reducing ramp-up time by two weeks."
        </p>

        <h3 className="text-lg font-semibold text-white">Add metrics whenever possible</h3>
        <p>
          Metrics create credibility. They show scale and make your achievements concrete. Use percentages, counts,
          revenue impact, response time, quality scores, project timelines, or customer volume. If exact numbers are not
          available, use conservative estimates and clear qualifiers. Metrics are one of the fastest ways to improve ATS
          resume quality and recruiter response.
        </p>

        <h3 className="text-lg font-semibold text-white">Prioritize clarity over complexity</h3>
        <p>
          Avoid jargon-heavy sentences that hide your impact. Recruiters should understand your value without re-reading.
          Keep bullets concise, front-load the most relevant achievements, and tailor wording to each target posting.
          Great resume bullet examples are clear, specific, and easy to scan.
        </p>

        <p>
          For deeper strategy, visit our <Link href="/blog" className="text-blue-300 hover:text-blue-200">blog</Link>{" "}
          for practical resume tips and role-specific guidance. You can also jump straight into the tool at{" "}
          <Link href="/resume-template-builder" className="text-blue-300 hover:text-blue-200">/resume-template-builder</Link>.
        </p>
      </SectionWrap>

      <SectionWrap id="faq" title="FAQ Section">
        <div className="space-y-4">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="text-lg font-semibold text-white">{item.question}</h3>
              <p className="mt-3 text-sm text-slate-300">{item.answer}</p>
            </article>
          ))}
        </div>
      </SectionWrap>

      <section id="final-cta" className="py-14 md:py-16">
        <div className="mx-auto max-w-5xl rounded-3xl border border-blue-500/30 bg-blue-500/10 px-6 py-10 text-center md:px-10">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Try the AI Resume Bullet Generator Now</h2>
          <p className="mx-auto mt-4 max-w-3xl text-slate-300">
            Stop guessing which resume bullets sound strong. Generate recruiter-ready lines, tailor them to your role,
            and apply with confidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/resume-template-builder"
              className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Generate My Resume Bullets
            </Link>
            <Link href="/blog" className="text-sm font-medium text-blue-200 hover:text-blue-100">
              Explore resume tips
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}