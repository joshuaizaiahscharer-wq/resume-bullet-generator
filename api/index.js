// Load environment variables for local development.
require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const supabase = require("../lib/supabase");
const { recordGeneratorUsage } = require("../lib/usageTracking");

const app = express();

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const PAYMENT_STATE_SECRET =
  process.env.PAYMENT_STATE_SECRET ||
  process.env.ADMIN_PASSWORD ||
  "local-dev-payment-state-secret";
const RESUME_UNLOCK_COOKIE = "resume_builder_unlock";
const RESUME_UNLOCK_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// Temporary paywall toggle for resume builder.
// Set to false to re-enable normal Stripe + unlock flow.
const DISABLE_RESUME_BUILDER_PAYWALL = true;

// Support email address for notifications
const SUPPORT_NOTIFY_EMAIL = process.env.SUPPORT_NOTIFY_EMAIL;

function getStripeClient() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  // Lazy-require to avoid crashing boot if dependency is missing in older deploys.
  const Stripe = require("stripe");
  return new Stripe(STRIPE_SECRET_KEY);
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};

  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function signValue(rawValue) {
  return crypto
    .createHmac("sha256", PAYMENT_STATE_SECRET)
    .update(rawValue)
    .digest("hex");
}

function createResumeUnlockToken({ sessionId, expiresAt }) {
  const payloadJson = JSON.stringify({ sessionId, expiresAt });
  const payload = Buffer.from(payloadJson).toString("base64url");
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function readResumeUnlockToken(token) {
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  const expectedSignature = signValue(payload);

  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded?.expiresAt || Number(decoded.expiresAt) < Date.now()) {
      return null;
    }
    return decoded;
  } catch (_err) {
    return null;
  }
}

function isResumeUnlocked(req) {
  if (DISABLE_RESUME_BUILDER_PAYWALL) {
    return true;
  }

  if (process.env.RESUME_TEMPLATE_BUILDER_UNLOCKED === "true") {
    return true;
  }

  const cookies = parseCookies(req);
  const token = cookies[RESUME_UNLOCK_COOKIE];
  return Boolean(readResumeUnlockToken(token));
}

function setResumeUnlockCookie(res, sessionId) {
  const expiresAt = Date.now() + RESUME_UNLOCK_TTL_MS;
  const token = createResumeUnlockToken({ sessionId, expiresAt });
  const isProduction = process.env.NODE_ENV === "production";

  const cookieParts = [
    `${RESUME_UNLOCK_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(RESUME_UNLOCK_TTL_MS / 1000)}`,
  ];

  if (isProduction) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

async function sendSupportNotificationEmail(supportRequest) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!SUPPORT_NOTIFY_EMAIL || !gmailUser || !gmailPass) {
    console.warn("[email] GMAIL_USER, GMAIL_APP_PASSWORD, or SUPPORT_NOTIFY_EMAIL not configured — skipping notification.");
    return;
  }

  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"BulletAI Support" <${gmailUser}>`,
      to: SUPPORT_NOTIFY_EMAIL,
      replyTo: supportRequest.email,
      subject: `New support message from ${supportRequest.name || supportRequest.email}`,
      html: `
        <h2>New Support Message</h2>
        <p><strong>From:</strong> ${escapeHtml(supportRequest.name || "Anonymous")} (${escapeHtml(supportRequest.email)})</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(supportRequest.message)}</p>
        <hr />
        <p style="font-size: 0.85em; color: #666;">
          <strong>Metadata:</strong><br />
          Page: ${escapeHtml(supportRequest.page_path || "Home")}<br />
          IP: ${escapeHtml(supportRequest.ip_address || "Unknown")}<br />
          Time: ${supportRequest.created_at || new Date().toISOString()}
        </p>
      `,
    });
    console.log("[email] Support notification sent", {
      to: SUPPORT_NOTIFY_EMAIL,
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
    });
  } catch (err) {
    console.error("[email] Failed to send notification:", err.message);
  }
}

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

    // Insert into Supabase with retry logic for missing columns
    let insertError = null;
    while (true) {
      const { error } = await supabase.from("support_requests").insert([payload]);

      if (!error) {
        console.log("[/api/support] Support request inserted successfully:", email);

        // Await email before responding — Vercel kills the function when res.json() is
        // called, so fire-and-forget never completes in a serverless environment.
        try {
          await sendSupportNotificationEmail({
            ...payload,
            created_at: new Date().toISOString(),
          });
        } catch (emailErr) {
          console.warn("[/api/support] Email notification error:", emailErr.message);
        }

        return res.json({ ok: true });
      }

      // If column is missing, retry without it
      const missingColumn = getMissingColumnName(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        console.warn("[/api/support] Missing column, retrying without:", missingColumn);
        delete payload[missingColumn];
        continue;
      }

      // Store error and break retry loop
      insertError = error;
      break;
    }

    // If we get here, insert failed after retries
    console.error("[/api/support] Supabase insert error after retries:", {
      code: insertError?.code,
      message: insertError?.message,
      details: insertError?.details,
    });
    
    return res.status(500).json({ error: "Unable to submit your message right now. Please try again later." });
  } catch (err) {
    console.error("[/api/support] Unexpected server error:", {
      message: err.message,
      stack: err.stack?.slice(0, 500), // Truncate stack for logging
    });
    return res.status(500).json({ error: "Unable to submit your message right now. Please try again later." });
  }
});

// ─── GET /api/admin/support ───────────────────────────────────────────────────
// Fetch support messages for admin dashboard
app.get("/api/admin/support", async (req, res) => {
  const password = (req.query.password || "").trim();

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const { data: recentSupportRequests, error } = await supabase
      .from("support_requests")
      .select("id, name, email, message, created_at, page_path, ip_address")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[/api/admin/support] Supabase error:", error.message);
      return res.status(500).json({ error: "Unable to fetch support messages." });
    }

    const { data: allRequests, error: countError } = await supabase
      .from("support_requests")
      .select("id", { count: "exact" });

    if (countError) {
      console.error("[/api/admin/support] Count error:", countError.message);
    }

    return res.json({
      totalRequests: allRequests?.length || 0,
      recentMessages: (recentSupportRequests || []).map((msg) => ({
        id: msg.id,
        name: msg.name,
        email: msg.email,
        message: msg.message.slice(0, 100) + (msg.message.length > 100 ? "..." : ""),
        createdAt: msg.created_at,
        pagePath: msg.page_path,
        ipAddress: msg.ip_address,
      })),
    });
  } catch (err) {
    console.error("[/api/admin/support] Unexpected error:", err.message);
    return res.status(500).json({ error: "Unable to fetch support messages." });
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
    "/resume-template-builder",
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

app.get("/resume-template-builder", (req, res) => {
  res.sendFile(path.join(process.cwd(), "resume-template-builder.html"));
});

// ─── Resume Builder payment state + Stripe checkout ─────────────────────────
app.get("/api/resume-builder/access", async (req, res) => {
  return res.json({ isUnlocked: isResumeUnlocked(req) });
});

app.post("/api/resume-builder/create-checkout-session", async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY is not configured.",
      });
    }

    if (!STRIPE_PRICE_ID) {
      return res.status(500).json({
        error: "STRIPE_PRICE_ID is not configured.",
      });
    }

    const stripe = getStripeClient();

    const fallbackReturnUrl = `${SITE_URL}/resume-template-builder`;
    const requestedReturnUrl = String(req.body?.returnUrl || "").trim();
    const baseReturnUrl = requestedReturnUrl || fallbackReturnUrl;

    let normalizedReturnUrl;
    try {
      const url = new URL(baseReturnUrl);
      if (!/^https?:$/.test(url.protocol)) {
        throw new Error("Invalid return URL protocol.");
      }
      normalizedReturnUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");
    } catch (_urlErr) {
      normalizedReturnUrl = fallbackReturnUrl;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Apple Pay is surfaced by Stripe Checkout as a card wallet when enabled in
      // Stripe Dashboard and the customer is on a supported device/browser.
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      billing_address_collection: "auto",
      success_url: `${normalizedReturnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${normalizedReturnUrl}?payment=cancelled`,
      metadata: {
        product: "resume_template_builder",
      },
    });

    if (!session?.url) {
      return res.status(500).json({
        error: "Stripe did not return a checkout URL.",
      });
    }

    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    const stripeErrorMessage =
      err?.raw?.message ||
      err?.message ||
      "Unable to create checkout session.";

    console.error("[/api/resume-builder/create-checkout-session] Stripe error:", {
      type: err?.type,
      code: err?.code,
      message: stripeErrorMessage,
    });

    return res.status(500).json({
      error: stripeErrorMessage,
      code: err?.code || null,
    });
  }
});

app.post("/api/resume-builder/verify-checkout-session", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({
        error: "Missing sessionId.",
        isUnlocked: false,
      });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session?.payment_status === "paid";
    const isCorrectProduct = session?.metadata?.product === "resume_template_builder";

    if (!isPaid || !isCorrectProduct) {
      return res.status(402).json({
        error: "Checkout session is not paid.",
        isUnlocked: false,
      });
    }

    // Backend-controlled access gate via signed HttpOnly cookie.
    // TODO(Stripe + Auth): persist purchase against authenticated user id in DB.
    setResumeUnlockCookie(res, sessionId);

    return res.json({ isUnlocked: true });
  } catch (err) {
    console.error("[/api/resume-builder/verify-checkout-session] Stripe verify error:", err.message);
    return res.status(500).json({
      error: "Unable to verify checkout session.",
      isUnlocked: false,
    });
  }
});

// ─── POST /api/resume-builder/revise ─────────────────────────────────────────
app.post("/api/resume-builder/revise", async (req, res) => {
  const { text, fieldType } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }

  const sanitizedText = text.trim().slice(0, 2000);

  const systemPrompts = {
    summary:
      "You are a professional resume writer. Rewrite the following professional summary to sound polished, confident, and compelling for a resume. Keep it concise (2–4 sentences). Return only the revised text, no commentary.",
    details:
      "You are a professional resume writer. Rewrite the following work experience description to use strong action verbs and quantified impact where possible. Keep it concise. Return only the revised text, no commentary.",
    description:
      "You are a professional resume writer. Rewrite the following project description to sound professional and results-oriented. Keep it concise. Return only the revised text, no commentary.",
    education:
      "You are a professional resume writer. Rewrite the following education details to sound polished and professional. Keep it concise. Return only the revised text, no commentary.",
  };

  const systemPrompt =
    systemPrompts[fieldType] ||
    "You are a professional resume writer. Rewrite the following text to sound more professional and polished for a resume. Return only the revised text, no commentary.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: sanitizedText },
      ],
      temperature: 0.6,
      max_tokens: 400,
    });

    const revised = (completion.choices[0]?.message?.content ?? "").trim();
    if (!revised) return res.status(500).json({ error: "No revision returned." });

    return res.json({ revised });
  } catch (err) {
    console.error("[/api/resume-builder/revise] OpenAI error:", err.message);
    return res.status(err.status ?? 500).json({ error: err.message ?? "Failed to revise text." });
  }
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
    /* ── Tabs ── */
    .admin-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .tab-btn {
      padding: 10px 14px;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      transition: color 0.2s, border-color 0.2s;
    }
    .tab-btn.active {
      color: #a78bfa;
      border-bottom-color: #a78bfa;
    }
    .tab-btn:hover { color: #c7d2fe; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .support-message-item {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .support-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .support-from {
      font-weight: 600;
      color: #cbd5e1;
      font-size: 0.9rem;
    }
    .support-date {
      font-size: 0.75rem;
      color: #64748b;
    }
    .support-msg {
      color: #cbd5e1;
      font-size: 0.85rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 6px;
    }
    .support-meta {
      font-size: 0.75rem;
      color: #64748b;
    }
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
    <h1>Admin Dashboard</h1>
    
    <div class="admin-tabs">
      <button class="tab-btn active" id="tab-analytics">Analytics</button>
      <button class="tab-btn" id="tab-support">Support Messages</button>
    </div>

    <!-- Analytics tab -->
    <div id="analytics-tab" class="tab-content active">
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

    <!-- Support Messages tab -->
    <div id="support-tab" class="tab-content">
      <div class="stat">
        <div class="stat-value" id="support-total">—</div>
        <div class="stat-label">Total support messages</div>
      </div>
      <h2 style="margin-top:16px;">Recent messages</h2>
      <p id="support-loading" style="display:none;">Loading…</p>
      <div id="support-list" style="max-height: 500px; overflow-y: auto;"></div>
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
    const tabAnalytics = document.getElementById("tab-analytics");
    const tabSupport = document.getElementById("tab-support");
    const analyticsTab = document.getElementById("analytics-tab");
    const supportTab = document.getElementById("support-tab");
    const supportLoading = document.getElementById("support-loading");
    const supportList = document.getElementById("support-list");
    const supportTotal = document.getElementById("support-total");
    let currentPassword = "";
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

      currentPassword = password;
      loginCard.style.display = "none";
      dashboard.style.display = "block";
      
      // Load support messages initially
      await loadSupportMessages(password);
    }

    // ── Tab switching ──────────────────────────────────────────────────────────
    function switchTab(tab) {
      if (tab === "analytics") {
        analyticsTab.classList.add("active");
        supportTab.classList.remove("active");
        tabAnalytics.classList.add("active");
        tabSupport.classList.remove("active");
      } else {
        supportTab.classList.add("active");
        analyticsTab.classList.remove("active");
        tabSupport.classList.add("active");
        tabAnalytics.classList.remove("active");
      }
    }

    if (tabAnalytics) tabAnalytics.addEventListener("click", () => switchTab("analytics"));
    if (tabSupport) tabSupport.addEventListener("click", () => switchTab("support"));

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

    // ── Load support messages ──────────────────────────────────────────────────
    async function loadSupportMessages(password) {
      supportLoading.style.display = "block";
      supportList.innerHTML = "";

      try {
        const res = await fetch("/api/admin/support?password=" + encodeURIComponent(password));
        const json = await res.json();

        if (!res.ok) {
          supportList.innerHTML = '<p style="color:#f87171;">Error loading messages</p>';
          return;
        }

        supportTotal.textContent = json.totalRequests.toLocaleString();

        if (!json.recentMessages || json.recentMessages.length === 0) {
          supportList.innerHTML = '<p style="color:#64748b;">No support messages yet.</p>';
        } else {
          renderSupportMessages(json.recentMessages);
        }
      } catch (err) {
        supportList.innerHTML = '<p style="color:#f87171;">Network error</p>';
      } finally {
        supportLoading.style.display = "none";
      }
    }

    function renderSupportMessages(rows) {
      supportList.innerHTML = "";
      rows.forEach((msg) => {
        const div = document.createElement("div");
        div.className = "support-message-item";
        const date = new Date(msg.createdAt);
        const dateStr = date.toLocaleString();
        div.innerHTML =
          '<div class="support-header">' +
            '<div class="support-from">' + escapeHtml(msg.name || msg.email) + ' <' + escapeHtml(msg.email) + '></div>' +
            '<div class="support-date">' + escapeHtml(dateStr) + '</div>' +
          '</div>' +
          '<div class="support-msg">' + escapeHtml(msg.message) + '</div>' +
          '<div class="support-meta">From: ' + escapeHtml(msg.pagePath || "Home") + ' | IP: ' + escapeHtml(msg.ipAddress || "—") + '</div>';
        supportList.appendChild(div);
      });
    }

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
      <div class="nav-actions">
        <a href="/resume-template-builder" class="nav-link">Resume Template Builder</a>
        <a href="/jobs" class="nav-link">Browse All Clusters</a>
      </div>
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
      <a href="/resume-template-builder">Resume Template Builder</a>
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
      <div class="nav-actions">
        <a href="/resume-template-builder" class="nav-link">Resume Template Builder</a>
        <a href="/" class="nav-link">&#8592; Home</a>
      </div>
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
      <a href="/resume-template-builder">Resume Template Builder</a>
      <a href="/#support">Contact support</a>
    </footer>
  </body>
</html>`;
}

module.exports = app;
