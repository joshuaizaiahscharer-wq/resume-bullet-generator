// Load environment variables for local development.
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const app = express();

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());

app.use(express.json());

// Serve static frontend files from project root.
app.use(express.static(path.join(process.cwd())));

// ─── OpenAI client ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Job data ─────────────────────────────────────────────────────────────────
const allJobs = require("../data/jobs");
const baseJobs = allJobs.baseJobs;
const jobBySlug = Object.fromEntries(allJobs.map((j) => [j.slug, j]));

// Hand-crafted overrides for jobs that have rich cluster content
const jobClusters = require("../data/jobClusters");
const clusterOverrides = Object.fromEntries(jobClusters.map((c) => [c.jobSlug, c]));

const PAGE_TYPE_ORDER = [
  "bulletPoints",
  "resumeSummary",
  "skills",
  "coverLetter",
  "noExperienceBulletPoints",
];

const PAGE_TYPE_META = {
  bulletPoints: {
    label: "Resume Bullet Points",
    heading: "10 Resume Bullet Point Examples",
  },
  resumeSummary: {
    label: "Resume Summary Examples",
    heading: "5 Resume Summary Examples",
  },
  skills: {
    label: "Skills for Resume",
    heading: "15 Skills for Resume",
  },
  coverLetter: {
    label: "Cover Letter Examples",
    heading: "3 Cover Letter Examples",
  },
  noExperienceBulletPoints: {
    label: "No Experience Resume Bullet Points",
    heading: "10 No-Experience Bullet Point Examples",
  },
};

// ─── Cluster content generators ───────────────────────────────────────────────
function generateSummaries(title) {
  return [
    `Dedicated ${title} with a strong track record of delivering consistent results and maintaining professional standards.`,
    `Detail-oriented ${title} known for reliability, clear communication, and effective execution under pressure.`,
    `Motivated ${title} with hands-on experience applying core skills to meet team and organizational goals daily.`,
    `Experienced ${title} who thrives in fast-paced environments and consistently meets or exceeds performance expectations.`,
    `Results-driven ${title} with proven ability to contribute quickly, collaborate across teams, and grow in the role.`,
  ];
}

function generateSkills(title) {
  return [
    `${title} operations`,
    "Customer service",
    "Team collaboration",
    "Time management",
    "Problem solving",
    "Communication",
    "Attention to detail",
    "Multitasking",
    "Organization",
    "Process efficiency",
    "Training and mentorship",
    "Documentation",
    "Performance tracking",
    "Quality assurance",
    "Adaptability",
  ];
}

function generateCoverLetters(title) {
  return [
    `I am excited to apply for the ${title} position. My background includes hands-on experience with the core responsibilities of this role, and I am confident I can contribute effectively from day one.`,
    `Your organization's focus on excellence and teamwork closely aligns with my approach as a ${title}. I have a track record of reliable execution and working collaboratively to meet goals on time.`,
    `I am applying for the ${title} opening with a strong foundation in the skills and work ethic needed to succeed. I take pride in professionalism and continuous improvement, and I welcome the chance to bring that to your team.`,
  ];
}

function buildClusterFromJob(job) {
  const title = job.title;
  const noExpJob = jobBySlug[`${job.slug}-no-experience`];
  const noExpBullets = noExpJob
    ? noExpJob.bullets
    : [
        `Demonstrated reliability and strong work ethic while learning foundational ${title} responsibilities.`,
        `Applied transferable skills from prior experience to support ${title} team goals effectively.`,
        `Learned key ${title} workflows and procedures quickly through observation and participation.`,
        `Maintained organized, professional conduct in a ${title} environment from day one.`,
        `Communicated clearly with teammates and customers while building core ${title} skills.`,
        `Followed established ${title} procedures closely to ensure consistent quality and accuracy.`,
        `Supported team priorities during busy periods with a positive, can-do attitude.`,
        `Accepted coaching and feedback from supervisors to steadily improve ${title} performance.`,
        `Maintained punctual, dependable attendance across all scheduled ${title} shifts.`,
        `Expressed strong enthusiasm for growing into an experienced ${title} through continuous learning.`,
      ];

  return {
    jobSlug: job.slug,
    jobTitle: title,
    pages: {
      bulletPoints: {
        slug: `resume-bullet-points-for-${job.slug}`,
        pageTitle: `Resume Bullet Points for ${title}`,
        metaDescription: job.metaDescription,
        intro: job.intro,
        content: job.bullets,
      },
      resumeSummary: {
        slug: `${job.slug}-resume-summary-examples`,
        pageTitle: `${title} Resume Summary Examples`,
        metaDescription: `5 ${title} resume summary examples to help you write a polished professional profile.`,
        intro: `Use these ${title} resume summary examples to craft a strong opening statement that highlights your experience and value to hiring managers.`,
        content: generateSummaries(title),
      },
      skills: {
        slug: `${job.slug}-skills-for-resume`,
        pageTitle: `${title} Skills for Resume`,
        metaDescription: `15 key ${title} skills to add to your resume and demonstrate to hiring managers.`,
        intro: `Add these ${title} resume skills to your skills section to showcase both technical and interpersonal strengths.`,
        content: generateSkills(title),
      },
      coverLetter: {
        slug: `${job.slug}-cover-letter-examples`,
        pageTitle: `${title} Cover Letter Examples`,
        metaDescription: `3 short ${title} cover letter examples you can adapt and personalize for your application.`,
        intro: `These ${title} cover letter examples give you a professional starting point you can customize with your own background and achievements.`,
        content: generateCoverLetters(title),
      },
      noExperienceBulletPoints: {
        slug: `${job.slug}-resume-bullets-no-experience`,
        pageTitle: `${title} Resume Bullet Points (No Experience)`,
        metaDescription: `10 no-experience ${title} resume bullet points focused on transferable skills and readiness to learn.`,
        intro: `New to ${title} roles? These bullet points help you present transferable strengths and a strong work ethic confidently to employers.`,
        content: noExpBullets,
      },
    },
  };
}

// Build a cluster for every base job; use jobClusters.js override where available
const allClusters = baseJobs.map((job) => clusterOverrides[job.slug] || buildClusterFromJob(job));
const clusterByJobSlug = Object.fromEntries(allClusters.map((c) => [c.jobSlug, c]));

const allClusterPages = allClusters.flatMap((cluster) =>
  PAGE_TYPE_ORDER.map((type) => ({
    jobSlug: cluster.jobSlug,
    jobTitle: cluster.jobTitle,
    pageType: type,
    ...cluster.pages[type],
  }))
);

// ─── POST /api/generate ───────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { jobTitle } = req.body;

  if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
    return res.status(400).json({ error: "A valid jobTitle is required." });
  }

  const sanitizedTitle = jobTitle.trim().slice(0, 100);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a professional resume writer. " +
            "Return exactly 10 bullet points, one per line, " +
            "each starting with a strong action verb. " +
            "Output only the bullet points - no introductory text, " +
            "no numbering, no extra commentary.",
        },
        {
          role: "user",
          content:
            `Create 10 professional resume bullet points for a ${sanitizedTitle}. ` +
            "Each bullet should begin with an action verb.",
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const bullets = text
      .split("\n")
      .map((line) => line.replace(/^[\s•\-–—*]+/, "").trim())
      .filter((line) => line.length > 0);

    return res.json({ bullets });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    const status = err.status ?? 500;
    const message = err.message ?? "Failed to generate bullet points.";
    return res.status(status).json({ error: message });
  }
});

// ─── SEO routes ───────────────────────────────────────────────────────────────
app.get("/robots.txt", (req, res) => {
  const robotsText = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  ].join("\n");

  res.type("text/plain").send(robotsText);
});

app.get("/sitemap.xml", (req, res) => {
  const paths = [
    "/",
    "/jobs",
    ...allClusterPages.map((page) => `/${page.slug}`),
  ];

  const urlEntries = paths
    .map((urlPath) => `  <url><loc>${escapeXml(`${SITE_URL}${urlPath}`)}</loc></url>`)
    .join("\n");

  const xml =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" +
    `${urlEntries}\n` +
    "</urlset>";

  res.type("application/xml").send(xml);
});

// ─── Cluster routes (5 page types per job) ───────────────────────────────────
app.get("/resume-bullet-points-for-:jobSlug", (req, res) => {
  renderClusterRoute(req, res, req.params.jobSlug, "bulletPoints");
});

app.get("/:jobSlug-resume-summary-examples", (req, res) => {
  renderClusterRoute(req, res, req.params.jobSlug, "resumeSummary");
});

app.get("/:jobSlug-skills-for-resume", (req, res) => {
  renderClusterRoute(req, res, req.params.jobSlug, "skills");
});

app.get("/:jobSlug-cover-letter-examples", (req, res) => {
  renderClusterRoute(req, res, req.params.jobSlug, "coverLetter");
});

app.get("/:jobSlug-resume-bullets-no-experience", (req, res) => {
  renderClusterRoute(req, res, req.params.jobSlug, "noExperienceBulletPoints");
});

app.get("/jobs", (req, res) => {
  res.send(renderJobsPage());
});

function renderClusterRoute(req, res, jobSlug, pageType) {
  const cluster = clusterByJobSlug[jobSlug];
  const page = cluster?.pages?.[pageType];

  if (!cluster || !page) {
    return res.status(404).send("Page not found.");
  }

  return res.send(renderClusterPage(cluster, pageType));
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const PAGE_HEAD = (title, description) => `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google-site-verification" content="VEIGdEbFNNwkV64kj97Igmt_5KO8trlNUXJtaIqVAw0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/style.css" />`;

function renderClusterPage(cluster, pageType) {
  const page = cluster.pages[pageType];
  const pageMeta = PAGE_TYPE_META[pageType];

  const contentItems = page.content
    .map((item) => `          <li>${escapeHtml(item)}</li>`)
    .join("\n");

  const relatedLinks = PAGE_TYPE_ORDER.filter((type) => type !== pageType)
    .map((type) => {
      const relatedPage = cluster.pages[type];
      const label = PAGE_TYPE_META[type].label;
      return `          <a href="/${escapeHtml(relatedPage.slug)}">${escapeHtml(cluster.jobTitle)} ${escapeHtml(label)}</a>`;
    })
    .join("\n");

  const generatorSection =
    pageType === "bulletPoints" || pageType === "noExperienceBulletPoints"
      ? `
    <div class="section-divider">
      <span>&#10022; Generate your own</span>
    </div>

    <main class="main">
      <div class="card">
        <label class="input-label" for="jobTitle">Customize for your experience</label>
        <div class="input-group">
          <input
            type="text"
            id="jobTitle"
            value="${escapeHtml(cluster.jobTitle)}"
            placeholder="e.g. Bartender, Software Engineer"
            aria-label="Job title"
            autocomplete="off"
          />
          <button id="generateBtn">
            <span class="btn-text">Generate Bullet Points</span>
            <span class="btn-arrow">&#8594;</span>
          </button>
        </div>
        <div id="status" class="status hidden" aria-live="polite"></div>
        <section id="resultsSection" class="results hidden" aria-live="polite">
          <div class="results-header">
            <h2>Your Bullet Points</h2>
            <button id="copyBtn" class="copy-btn">Copy All</button>
          </div>
          <ul id="bulletList"></ul>
        </section>
      </div>
    </main>

    <script src="/script.js"></script>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(`${page.pageTitle} | BulletAI`, page.metaDescription)}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/jobs" class="nav-link">Browse All Clusters</a>
    </nav>

    <header class="hero">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>&#8250;</span>
        <a href="/jobs">Jobs</a>
        <span>&#8250;</span>
        <span>${escapeHtml(cluster.jobTitle)}</span>
      </nav>
      <h1><span class="gradient-text">${escapeHtml(page.pageTitle)}</span></h1>
      <p class="hero-sub">${escapeHtml(page.intro)}</p>
    </header>

    <section class="main" aria-labelledby="content-heading">
      <div class="card">
        <p class="input-label" id="content-heading">${escapeHtml(pageMeta.heading)}</p>
        <ul class="example-bullets">
${contentItems}
        </ul>
      </div>
    </section>

    <section class="main" aria-labelledby="related-resources-heading">
      <div class="card related-resources-card">
        <p class="input-label" id="related-resources-heading">Related Resume Resources</p>
        <div class="job-links-grid">
${relatedLinks}
        </div>
      </div>
    </section>
${generatorSection}
    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

function renderJobsPage() {
  const groups = allClusters
    .map((cluster) => {
      const pageLinks = PAGE_TYPE_ORDER.map((type) => {
        const page = cluster.pages[type];
        return `            <a href="/${escapeHtml(page.slug)}">${escapeHtml(PAGE_TYPE_META[type].label)}</a>`;
      }).join("\n");

      return `        <section class="cluster-group" aria-labelledby="cluster-${escapeHtml(cluster.jobSlug)}">
          <h2 class="cluster-group-title" id="cluster-${escapeHtml(cluster.jobSlug)}">${escapeHtml(cluster.jobTitle)}</h2>
          <div class="job-links-grid">
${pageLinks}
          </div>
        </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(
    "Resume Resource Clusters by Job Title | BulletAI",
    "Browse resume bullet points, summaries, skills, cover letters, and no-experience examples grouped by job title."
  )}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/" class="nav-link">&#8592; Home</a>
    </nav>

    <header class="hero">
      <span class="badge">&#10022; Job Clusters</span>
      <h1>Resume Resources by <span class="gradient-text">Job Title</span></h1>
      <p class="hero-sub">
        Explore complete content clusters for each role, including bullet points,
        summaries, skills, cover letters, and no-experience examples.
      </p>
    </header>

    <main class="main">
      <div class="card cluster-list-card">
${groups}
      </div>
    </main>

    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

module.exports = app;
