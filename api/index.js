// Load environment variables for local development.
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const supabase = require("../lib/supabase");
const { recordGeneratorUsage } = require("../lib/usageTracking");

const app = express();

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

function getAuthenticatedUserId(req) {
  // Works with common auth middlewares if present in the future.
  const directUserId =
    req?.user?.id ||
    req?.userId ||
    req?.auth?.userId ||
    req?.session?.user?.id ||
    req?.session?.uid ||
    null;

  if (directUserId) {
    return String(directUserId);
  }

  // Safe fallback when upstream proxy forwards user identity.
  const headerUserId = req.get("x-user-id");
  if (headerUserId) {
    return String(headerUserId);
  }

  return null;
}

function getMissingColumnName(error) {
  const message = error?.message || "";
  const patterns = [
    /column ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
    /Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
  const { jobTitle, pagePath, pageType, userId: bodyUserId } = req.body;

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

    // Record usage after successful generation.
    // Wrapped in its own try/catch so tracking issues never affect users.
    try {
      const ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        null;

      const trackedUserId =
        getAuthenticatedUserId(req) ||
        (bodyUserId ? String(bodyUserId) : null) ||
        ipAddress;

      await recordGeneratorUsage({
        jobTitle: sanitizedTitle,
        pagePath: pagePath || null,
        pageType: pageType || null,
        userId: trackedUserId,
        userAgent: req.headers["user-agent"] || null,
        ipAddress,
      });
    } catch (trackingErr) {
      // Double-safety guard; helper already handles failures internally.
      console.warn("[usageTracking] Route-level tracking error:", trackingErr.message);
    }

    return res.json({ bullets });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    const status = err.status ?? 500;
    const message = err.message ?? "Failed to generate bullet points.";
    return res.status(status).json({ error: message });
  }
});

// ─── GET /api/test-supabase ──────────────────────────────────────────────────
// Health-check route to verify the Supabase connection is working.
// Remove or protect this route before going to production if desired.
app.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("generator_usage")
      .select("id, job_title, normalized_job_title, created_at, page_path, page_type")
      .limit(5);

    if (error) {
      console.error("[/api/test-supabase] Supabase error:", error.message);
      return res.status(500).json({ status: "error", message: error.message });
    }

    return res.json({ status: "connected", data: data ?? [] });
  } catch (err) {
    console.error("[/api/test-supabase] Unexpected error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// ─── GET /api/usage-summary ─────────────────────────────────────────────────
// Lightweight analytics endpoint for generator usage.
app.get("/api/usage-summary", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("generator_usage")
      .select("normalized_job_title, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[/api/usage-summary] Supabase error:", error.message);
      return res.status(500).json({ status: "error", message: error.message });
    }

    const rows = data ?? [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const dayCounts = new Map();
    const titleCounts = new Map();
    let last7Days = 0;
    let last30Days = 0;

    for (const row of rows) {
      const ts = Date.parse(row.created_at);
      if (!Number.isNaN(ts)) {
        if (ts >= sevenDaysAgo) last7Days += 1;
        if (ts >= thirtyDaysAgo) last30Days += 1;
      }

      const dayKey = (row.created_at || "").slice(0, 10);
      if (dayKey) {
        dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
      }

      const title = (row.normalized_job_title || "").trim();
      if (title) {
        titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
      }
    }

    const byDay = [...dayCounts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topJobTitles = [...titleCounts.entries()]
      .map(([jobTitle, count]) => ({ jobTitle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      status: "connected",
      totals: {
        totalEvents: rows.length,
        last7Days,
        last30Days,
      },
      byDay,
      topJobTitles,
    });
  } catch (err) {
    console.error("[/api/usage-summary] Unexpected error:", err.message);
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// ─── POST /api/support ───────────────────────────────────────────────────────
// Saves support requests to Supabase so the team can follow up.
app.post("/api/support", async (req, res) => {
  const name = (req.body?.name || "").trim().slice(0, 120);
  const email = (req.body?.email || "").trim().toLowerCase().slice(0, 200);
  const message = (req.body?.message || "").trim().slice(0, 4000);
  const pagePath = (req.body?.pagePath || "").trim().slice(0, 300);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  if (!message || message.length < 10) {
    return res
      .status(400)
      .json({ error: "Please add a short message (at least 10 characters)." });
  }

  try {
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    const payload = {
      name: name || null,
      email,
      message,
      page_path: pagePath || null,
      user_agent: req.headers["user-agent"] || null,
      ip_address: ipAddress,
    };

    while (true) {
      const { error } = await supabase.from("support_requests").insert([payload]);

      if (!error) {
        console.log("[/api/support] Support request inserted successfully:", email);
        return res.json({ ok: true });
      }

      const missingColumn = getMissingColumnName(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        console.warn("[/api/support] Missing column, retrying without:", missingColumn);
        delete payload[missingColumn];
        continue;
      }

      console.error("[/api/support] Supabase insert error:", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return res.status(500).json({ error: "Unable to submit your message right now." });
    }
  } catch (err) {
    console.error("[/api/support] Unexpected error:", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Unable to submit your message right now." });
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

// ─── GET /admin ───────────────────────────────────────────────────────────────
app.get("/admin", (req, res) => {
  res.send(renderAdminPage());
});

// ─── renderAdminPage ──────────────────────────────────────────────────────────
function renderAdminPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #0b0f1a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: #131929;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 36px 32px;
      width: 100%;
      max-width: 380px;
    }
    h1 { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; margin-bottom: 24px; }
    label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 6px; }
    input {
      display: block;
      width: 100%;
      background: #0b0f1a;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 0.95rem;
      padding: 10px 14px;
      font-family: inherit;
      outline: none;
      margin-bottom: 16px;
    }
    input:focus { border-color: #6366f1; }
    button {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px;
      font-size: 0.95rem;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
    }
    button:hover { opacity: 0.9; }
    #error-msg { color: #f87171; font-size: 0.82rem; margin-top: 10px; display: none; }
    /* ── Dashboard ── */
    #dashboard { display: none; }
    #dashboard h1 { margin-bottom: 20px; }
    .stat {
      background: rgba(99,102,241,0.1);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      margin-bottom: 24px;
    }
    .stat-value { font-size: 2rem; font-weight: 700; color: #a78bfa; }
    .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 4px; }
    h2 { font-size: 0.95rem; font-weight: 600; color: #cbd5e1; margin-bottom: 12px; }
    ol { list-style: none; padding: 0; }
    ol li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 5px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .rank { color: #475569; font-size: 0.8rem; width: 20px; flex-shrink: 0; }
    .job-name { flex: 1; padding: 0 10px; text-transform: capitalize; font-size: 0.9rem; }
    .badge {
      background: rgba(99,102,241,0.2);
      color: #818cf8;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
    }
    #loading { color: #64748b; font-size: 0.875rem; margin-top: 12px; display: none; }
    .jobs-table-wrap {
      margin-top: 20px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      overflow-x: auto;
      background: rgba(255,255,255,0.02);
    }
    .jobs-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 520px;
      font-size: 0.82rem;
    }
    .jobs-table th,
    .jobs-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      text-align: left;
      vertical-align: middle;
    }
    .jobs-table th { color: #94a3b8; font-weight: 600; }
    .jobs-table td { color: #cbd5e1; }
    .jobs-table tr:last-child td { border-bottom: none; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .copy-user-btn {
      border: 1px solid rgba(129,140,248,0.35);
      background: transparent;
      color: #a5b4fc;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 0.75rem;
      cursor: pointer;
      margin-left: 8px;
      width: auto;
    }
    .copy-user-btn:hover { border-color: #818cf8; color: #c7d2fe; }
  </style>
</head>
<body>

  <!-- Login form -->
  <div class="card" id="login-card">
    <h1>Admin Login</h1>
    <label for="user-input">Username</label>
    <input type="text" id="user-input" placeholder="admin" autocomplete="username" />
    <label for="pw-input">Password</label>
    <input type="password" id="pw-input" placeholder="Password" autocomplete="current-password" />
    <button id="login-btn">Login</button>
    <p id="error-msg">Invalid login</p>
  </div>

  <!-- Dashboard (hidden until login) -->
  <div class="card" id="dashboard">
    <h1>Analytics Dashboard</h1>
    <div class="stat">
      <div class="stat-value" id="stat-total">—</div>
      <div class="stat-label">Total generations</div>
    </div>
    <h2>Top 20 searched job titles</h2>
    <p id="loading">Loading…</p>
    <ol id="job-list"></ol>

    <h2 style="margin-top:20px;">Recent generated jobs</h2>
    <div class="jobs-table-wrap">
      <table class="jobs-table" aria-label="Recent generated jobs">
        <thead>
          <tr>
            <th>Job</th>
            <th>User ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody id="recent-jobs-body"></tbody>
      </table>
    </div>
  </div>

  <script>
    const loginCard = document.getElementById("login-card");
    const dashboard = document.getElementById("dashboard");
    const userInput = document.getElementById("user-input");
    const pwInput   = document.getElementById("pw-input");
    const loginBtn  = document.getElementById("login-btn");
    const errorMsg  = document.getElementById("error-msg");
    const loading   = document.getElementById("loading");
    const jobList   = document.getElementById("job-list");
    const recentJobsBody = document.getElementById("recent-jobs-body");
    const statTotal = document.getElementById("stat-total");

    // ── Login ───────────────────────────────────────────────────────────────────
    async function handleLogin() {
      const username = (userInput.value || "admin").trim().toLowerCase();
      const password = pwInput.value.trim();

      // Username gate on the client. Password is validated by backend.
      if (username !== "admin" || !password) {
        errorMsg.textContent = "Invalid login";
        errorMsg.style.display = "block";
        pwInput.value = "";
        pwInput.focus();
        return;
      }

      errorMsg.style.display = "none";

      // Validate password by attempting to load analytics.
      const result = await loadAnalytics(password);
      if (!result.ok) {
        errorMsg.textContent = result.message || "Invalid login";
        errorMsg.style.display = "block";
        pwInput.value = "";
        pwInput.focus();
        return;
      }

      loginCard.style.display = "none";
      dashboard.style.display = "block";
    }

    // ── Load analytics from backend ─────────────────────────────────────────────
    async function loadAnalytics(password) {
      loading.style.display = "block";
      jobList.innerHTML = "";

      try {
        const res = await fetch("/api/admin/usage?password=" + encodeURIComponent(password));
        const json = await res.json();

        if (!res.ok) {
          return { ok: false, message: json.error === "Unauthorized." ? "Invalid login" : (json.error || "Login failed") };
        }

        statTotal.textContent = json.totalRecords.toLocaleString();

        if (!json.topJobs || json.topJobs.length === 0) {
          jobList.innerHTML = '<li style="color:#475569;font-size:.9rem;padding:8px 0">No data yet.</li>';
        } else {
          json.topJobs.forEach(({ job, count }, i) => {
            const li = document.createElement("li");
            li.innerHTML =
              '<span class="rank">' + (i + 1) + '</span>' +
              '<span class="job-name">' + escapeHtml(job) + '</span>' +
              '<span class="badge">' + count.toLocaleString() +
              ' ' + (count === 1 ? 'search' : 'searches') + '</span>';
            jobList.appendChild(li);
          });
        }

        renderRecentJobs(json.recentJobs || []);

        return { ok: true };
      } catch (err) {
        return { ok: false, message: "Network error" };
      } finally {
        loading.style.display = "none";
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    function truncateUserId(id) {
      const value = String(id || "");
      if (!value) return "—";
      if (value.length <= 18) return value;
      return value.slice(0, 7) + "..." + value.slice(-4);
    }

    function formatDate(value) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    }

    function renderRecentJobs(rows) {
      recentJobsBody.innerHTML = "";

      if (!rows.length) {
        recentJobsBody.innerHTML = '<tr><td colspan="3" style="color:#64748b;">No recent rows.</td></tr>';
        return;
      }

      rows.forEach((row) => {
        const userId = row.userId || "";
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + escapeHtml(row.job || "—") + '</td>' +
          '<td class="mono" title="' + escapeHtml(userId || "No user id") + '">' +
            escapeHtml(truncateUserId(userId)) +
            (userId ? '<button type="button" class="copy-user-btn" data-user-id="' + escapeHtml(userId) + '">Copy</button>' : '') +
          '</td>' +
          '<td>' + escapeHtml(formatDate(row.createdAt)) + '</td>';
        recentJobsBody.appendChild(tr);
      });
    }

    recentJobsBody.addEventListener("click", async (e) => {
      const btn = e.target.closest(".copy-user-btn");
      if (!btn) return;
      const userId = btn.getAttribute("data-user-id") || "";
      if (!userId) return;

      try {
        await navigator.clipboard.writeText(userId);
        const original = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = original; }, 900);
      } catch (_err) {
        // Clipboard can fail in some browsers; ignore silently.
      }
    });

    loginBtn.addEventListener("click", handleLogin);
    [userInput, pwInput].forEach(el => {
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
    });
  </script>
</body>
</html>`;
}

function renderClusterRoute(req, res, jobSlug, pageType) {  const cluster = clusterByJobSlug[jobSlug];
  const page = cluster?.pages?.[pageType];

  if (!cluster || !page) {
    return res.status(404).send("Page not found.");
  }

  return res.send(renderClusterPage(cluster, pageType));
}

// ─── CTA helper ───────────────────────────────────────────────────────────────
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
      <a href="/#support">Contact support</a>
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
      <a href="/#support">Contact support</a>
    </footer>
  </body>
</html>`;
}

module.exports = app;
