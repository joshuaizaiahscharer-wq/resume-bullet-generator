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

// ─── Jobs data ────────────────────────────────────────────────────────────────
const jobs = require("../data/jobs");
const jobMap = Object.fromEntries(jobs.map((j) => [j.slug, j]));

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
  const paths = ["/", "/jobs", ...jobs.map((job) => `/resume-bullet-points-for-${job.slug}`)];

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

// ─── Jobs pages ───────────────────────────────────────────────────────────────
app.get("/resume-bullet-points-for-:slug", (req, res) => {
  const job = jobMap[req.params.slug];
  if (!job) return res.status(404).send("Page not found.");
  res.send(renderJobPage(job));
});

app.get("/jobs", (req, res) => {
  res.send(renderJobsPage());
});

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

function renderJobPage(job) {
  const bulletItems = job.bullets
    .map((b) => `          <li>${escapeHtml(b)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(
    `Resume Bullet Points for ${job.title} | BulletAI`,
    job.metaDescription
  )}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/" class="nav-link">&#8592; Home</a>
    </nav>

    <header class="hero">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>&#8250;</span>
        <span>${escapeHtml(job.title)}</span>
      </nav>
      <h1>Resume Bullet Points<br /><span class="gradient-text">for ${escapeHtml(job.title)}</span></h1>
      <p class="hero-sub">${escapeHtml(job.intro)}</p>
    </header>

    <section class="main" aria-labelledby="examples-heading">
      <div class="card">
        <p class="input-label" id="examples-heading">10 Example Bullet Points</p>
        <ul class="example-bullets">
${bulletItems}
        </ul>
      </div>
    </section>

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
            value="${escapeHtml(job.title)}"
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

    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>

    <script src="/script.js"></script>
  </body>
</html>`;
}

function renderJobsPage() {
  const links = jobs
    .map(
      (j) =>
        `          <a href="/resume-bullet-points-for-${j.slug}">${escapeHtml(j.title)}</a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(
    "Resume Bullets by Job Title | BulletAI",
    "Browse free AI-generated resume bullet points for specific job titles. Pick your role and get 10 strong, action-verb-led bullets instantly."
  )}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/" class="nav-link">&#8592; Home</a>
    </nav>

    <header class="hero">
      <span class="badge">&#10022; All Job Pages</span>
      <h1>Resume Bullets by <span class="gradient-text">Job Title</span></h1>
      <p class="hero-sub">
        Browse example resume bullet points for specific roles, or use the AI
        generator on any page to create a personalized set.
      </p>
    </header>

    <main class="main">
      <div class="card">
        <p class="input-label">Browse job pages</p>
        <div class="job-links-grid">
${links}
        </div>
      </div>
    </main>

    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

module.exports = app;
