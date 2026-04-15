const path = require("path");
// Load environment variables for local development.
const fs = require("fs");
const dotenv = require("dotenv");
const envLocalPath = path.join(process.cwd(), ".env.local");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

let setupAuth = async () => {};
let registerAuthRoutes = () => {};
let isAuthenticated = (_req, res) => res.status(401).json({ message: "Unauthorized" });

try {
  ({ setupAuth, registerAuthRoutes, isAuthenticated } = require("../lib/replitAuth"));
} catch (err) {
  console.warn("[auth] Replit auth module unavailable; using Supabase-only auth flow.", err.message);
}

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const mammoth = require("mammoth");
const PDFDocument = require("pdfkit");
const { AlignmentType, Document, Packer, Paragraph, TextRun } = require("docx");
const supabase = require("../lib/supabase");
const { recordGeneratorUsage } = require("../lib/usageTracking");
const {
  blogPosts: staticBlogPosts,
  blogPostBySlug: staticBlogPostBySlug,
  renderBlogListPage,
  renderBlogPostPage,
  buildExcerpt,
} = require("../lib/blogPages");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const STRIPE_RESUME_BUILDER_PRODUCT_ID =
  process.env.STRIPE_RESUME_BUILDER_PRODUCT_ID || "prod_UJ4Tmx8IUQ7RbM";
const STRIPE_RESUME_BUILDER_PRICE_ID =
  process.env.STRIPE_RESUME_BUILDER_PRICE_ID ||
  process.env.STRIPE_PRICE_ID ||
  "price_1TKSK812xoyNnQNyp8AhmWhP";
const STRIPE_CHECK_MY_RESUME_PRODUCT_ID =
  process.env.STRIPE_CHECK_MY_RESUME_PRODUCT_ID || "prod_UKBRUZb1LrPcpV";
const STRIPE_CHECK_MY_RESUME_PRICE_ID =
  process.env.STRIPE_CHECK_MY_RESUME_PRICE_ID || "price_1TLX4E12xoyNnQNyqanmPF7z";
const SUPABASE_URL_PUBLIC =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const PAYMENT_STATE_SECRET =
  process.env.PAYMENT_STATE_SECRET ||
  process.env.ADMIN_PASSWORD ||
  "local-dev-payment-state-secret";
const RESUME_UNLOCK_COOKIE = "resume_builder_unlock";
const RESUME_UNLOCK_TTL_MS = 1000 * 60 * 60 * 24 * 30;

// Temporary paywall toggle for resume builder.
// Keep false to enforce normal Stripe + unlock flow.
const DISABLE_RESUME_BUILDER_PAYWALL = false;

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



async function getAdminProfileByReplitSub(replitSub) {
  if (!replitSub) return null;

  const { data, error } = await supabase
    .from("users")
    .select("replit_sub, is_admin")
    .eq("replit_sub", replitSub)
    .maybeSingle();

  if (error) {
    const missingColumn = getMissingColumnName(error);
    if (missingColumn === "replit_sub") {
      return null;
    }
    console.error("[admin] Failed to load user profile by replit_sub:", error.message);
    throw new Error("Failed to verify admin access.");
  }

  return data || null;
}

function isAdminPasswordSession(req) {
  return req.session && req.session.adminPasswordAuth === true;
}

async function requireAdminAccess(req, res, next) {
  if (isAdminPasswordSession(req)) {
    return next();
  }
  if (req.isAuthenticated && req.isAuthenticated()) {
    const replitSub = req.user && req.user.claims && req.user.claims.sub;
    const profile = await getAdminProfileByReplitSub(replitSub).catch(() => null);
    if (profile?.is_admin) return next();
    return res.status(403).json({ error: "Admin access required." });
  }
  return res.status(401).json({ message: "Unauthorized" });
}

function getOpenAIClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

function getMissingColumnName(error) {
  const message = error?.message || "";
  const patterns = [
    /column ["']?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)["']? does not exist/i,
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

function parseJsonPayload(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch (_err) {
    return null;
  }
}

function parseBlogDraftFallback(value, topic) {
  const text = String(value || "").trim();
  if (!text) {
    return {
      title: String(topic || "Untitled Post").trim(),
      content: "",
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let title = String(topic || "Untitled Post").trim();
  let content = text;

  if (lines.length) {
    const firstLine = lines[0].replace(/^#\s*/, "").trim();
    if (firstLine.length >= 8 && firstLine.length <= 120) {
      title = firstLine;
      content = lines.slice(1).join("\n").trim() || text;
    }
  }

  return { title, content };
}

function extractResponseText(response) {
  if (response?.output_text) {
    return String(response.output_text).trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const entry of content) {
      if (entry?.type === "output_text" && entry?.text) {
        parts.push(entry.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function buildBlogImagePrompt(topicOrTitle, customPrompt) {
  const base = String(customPrompt || "").trim() || String(topicOrTitle || "").trim();
  return [
    base,
    "modern, minimal, professional editorial photo",
    "soft natural lighting",
    "clean workspace aesthetic",
    "resume/career context",
    "subtle depth of field",
    "no text, no logos, no watermark",
    "high-quality, realistic, polished",
    "16:9 composition",
  ].join(", ");
}

function slugifyForSeed(value) {
  return String(value || "career")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "career";
}

function buildReliableStockFallbackUrl(topicOrTitle) {
  const seed = slugifyForSeed(topicOrTitle);
  return `https://picsum.photos/seed/${seed}/1600/900`;
}

async function fetchUnsplashImageUrl(topicOrTitle) {
  const accessKey = String(process.env.UNSPLASH_ACCESS_KEY || "").trim();
  if (!accessKey) return null;

  const query = encodeURIComponent(
    `${String(topicOrTitle || "career").trim()} professional resume office minimal`
  );

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?orientation=landscape&content_filter=high&query=${query}&client_id=${encodeURIComponent(accessKey)}`
    );
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.urls?.regular || payload?.urls?.full || null;
  } catch (_err) {
    return null;
  }
}

async function generateBlogImageUrl(client, topicOrTitle, customPrompt) {
  const imagePrompt = buildBlogImagePrompt(topicOrTitle, customPrompt);
  const unsplashUrl = await fetchUnsplashImageUrl(topicOrTitle);
  const fallbackUrl = unsplashUrl || buildReliableStockFallbackUrl(topicOrTitle);

  try {
    const imageResponse = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
      prompt: imagePrompt,
      size: "1792x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = imageResponse?.data?.[0]?.url || null;
    if (!imageUrl) {
      return {
        imageUrl: fallbackUrl,
        imagePrompt,
        imageSource: unsplashUrl ? "unsplash-api" : "stock-fallback",
      };
    }

    return {
      imageUrl,
      imagePrompt,
      imageSource: "openai",
    };
  } catch (err) {
    console.warn("[blog-image] OpenAI image generation failed, using fallback:", err?.message);
    return {
      imageUrl: fallbackUrl,
      imagePrompt,
      imageSource: unsplashUrl ? "unsplash-api" : "stock-fallback",
    };
  }
}

async function fetchPublishedBlogPosts() {
  let selectFields = "slug, title, content, meta_description, created_at, image, image_prompt";
  while (true) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(selectFields)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (!error) {
      return (data || []).map((row) => ({
        slug: row.slug,
        title: row.title,
        date: row.created_at,
        excerpt: buildExcerpt(row.content, 150),
        description: row.meta_description || buildExcerpt(row.content, 170),
        metaDescription: row.meta_description || null,
        content: row.content,
        author: null,
        image: row.image || null,
        imagePrompt: row.image_prompt || null,
      }));
    }

    const missingColumn = getMissingColumnName(error);
    if (missingColumn && selectFields.includes(missingColumn)) {
      selectFields = selectFields
        .split(",")
        .map((field) => field.trim())
        .filter((field) => field !== missingColumn)
        .join(", ");
      continue;
    }

    throw error;
  }
}

async function fetchPublishedBlogPostBySlug(slug) {
  let selectFields = "slug, title, content, meta_description, created_at, image, image_prompt";
  while (true) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(selectFields)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!error) {
      if (!data) return null;
      return {
        slug: data.slug,
        title: data.title,
        date: data.created_at,
        description: data.meta_description || buildExcerpt(data.content, 180),
        metaDescription: data.meta_description || null,
        content: data.content,
        author: null,
        image: data.image || null,
        imagePrompt: data.image_prompt || null,
      };
    }

    const missingColumn = getMissingColumnName(error);
    if (missingColumn && selectFields.includes(missingColumn)) {
      selectFields = selectFields
        .split(",")
        .map((field) => field.trim())
        .filter((field) => field !== missingColumn)
        .join(", ");
      continue;
    }

    throw error;
  }
}

// ─── Replit Auth (session + passport — must register before all other middleware) ─
// setupAuth is async (it discovers OIDC config); we attach a _authReady promise so
// server.js can await it before calling app.listen. Errors propagate for fail-fast.
app._authReady = setupAuth(app).then(() => {
  registerAuthRoutes(app);
  console.log("[auth] Replit Auth routes registered.");
}).catch((err) => {
  console.warn("[auth] Replit auth setup failed; continuing without it.", err?.message || err);
});

// ─── Core middleware (after auth session/passport are queued) ─────────────────
app.use(cors());

app.use(express.json());

// Stub out Vercel Analytics so the script tag in index.html doesn't 404.
app.get("/_vercel/insights/script.js", (_req, res) => {
  res.type("application/javascript").send("/* Vercel Analytics stub — not active outside Vercel */");
});

// Serve static frontend files from project root.
app.use(express.static(path.join(process.cwd())));

// ─── OpenAI client (lazy — instantiated on first use to avoid crashing boot) ──
let _openaiClient = null;
function getOpenAIClientLazy() {
  if (!_openaiClient) {
    _openaiClient = getOpenAIClient();
  }
  return _openaiClient;
}
const openai = new Proxy({}, {
  get(_target, prop) {
    return getOpenAIClientLazy()[prop];
  },
});

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

function analyzeResume(bullets) {
  const safeBullets = Array.isArray(bullets) ? bullets : [];
  const text = safeBullets.join(" ").toLowerCase();

  let score = 100;
  const feedback = [];

  const actionVerbs = [
    "managed", "developed", "led", "created",
    "improved", "increased", "reduced", "implemented",
    "designed", "optimized",
  ];

  const hasActionVerb = actionVerbs.some((verb) => text.includes(verb));
  if (!hasActionVerb) {
    score -= 15;
    feedback.push("Use stronger action verbs (e.g., managed, developed, led)");
  }

  const hasMetrics = /\d+%|\d+\+|\$\d+/g.test(text);
  if (!hasMetrics) {
    score -= 20;
    feedback.push("Add measurable results (e.g., %, $, numbers)");
  }

  const bulletStarts = safeBullets
    .map((b) => String(b || "").trim())
    .filter(Boolean)
    .map((b) => b.split(/\s+/)[0].toLowerCase());
  const uniqueStarts = new Set(bulletStarts);
  if (bulletStarts.length && uniqueStarts.size < bulletStarts.length / 2) {
    score -= 10;
    feedback.push("Avoid repeating the same starting words in bullets");
  }

  const tooShort = safeBullets.some((b) => String(b || "").trim().split(/\s+/).length < 6);
  if (tooShort) {
    score -= 10;
    feedback.push("Some bullets are too short - add more detail");
  }

  const strongKeywords = [
    "customer", "sales", "inventory", "team",
    "performance", "efficiency", "operations",
  ];
  const keywordMatches = strongKeywords.filter((k) => text.includes(k));
  if (keywordMatches.length < 3) {
    score -= 10;
    feedback.push("Include more relevant industry keywords");
  }

  if (score < 0) score = 0;

  return { score, feedback };
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
  const { jobTitle, jobDescription, pagePath, pageType, userId: bodyUserId } = req.body;

  if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
    return res.status(400).json({ error: "Job title is required." });
  }

  const sanitizedTitle = jobTitle.trim().slice(0, 100);
  const sanitizedJobDescription = String(jobDescription || "").trim();
  const hasJobDescription = sanitizedJobDescription.length > 10;

  let prompt;
  if (hasJobDescription) {
    prompt = `
Generate 10 professional resume bullet points for a ${sanitizedTitle}.

Align the bullets with this job description:
${sanitizedJobDescription}

- Keep bullets concise
- Focus on achievements
- Use natural language
`;
  } else {
    prompt = `
Generate 10 strong resume bullet points for a ${sanitizedTitle}.

- Focus on common responsibilities
- Make them professional and impactful
`;
  }

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
          content: prompt,
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
    const analysis = analyzeResume(bullets);
    console.log("Score:", analysis.score);
    console.log("Feedback:", analysis.feedback);

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

    return res.json({
      bullets,
      score: analysis.score,
      feedback: analysis.feedback,
    });
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

// ─── POST /api/admin/password-login ──────────────────────────────────────────
app.post("/api/admin/password-login", async (req, res) => {
  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !password || password !== adminPassword) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  req.session.adminPasswordAuth = true;
  return res.json({ ok: true });
});

// ─── POST /api/admin/password-logout ─────────────────────────────────────────
app.post("/api/admin/password-logout", (req, res) => {
  if (req.session) req.session.adminPasswordAuth = false;
  return res.json({ ok: true });
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Fetch all users for admin dashboard (uses service role key, bypasses RLS)
app.get("/api/admin/users", requireAdminAccess, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, is_logged_in, has_paid, plan, payment_date, last_active, is_admin")
      .order("last_active", { ascending: false });

    if (error) {
      console.error("[/api/admin/users] Supabase error:", error.message);
      return res.status(500).json({ error: "Unable to fetch users." });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[/api/admin/users] Unexpected error:", err.message);
    return res.status(500).json({ error: "Unable to fetch users." });
  }
});

// ─── PATCH /api/admin/users/:userId/payment ───────────────────────────────────
app.patch("/api/admin/users/:userId/payment", requireAdminAccess, async (req, res) => {
  const { userId } = req.params;
  const { hasPaid } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required." });

  const updates = hasPaid
    ? { has_paid: true, plan: "paid", payment_date: new Date().toISOString() }
    : { has_paid: false, plan: "free", payment_date: null };

  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  if (error) {
    console.error("[/api/admin/users/:userId/payment] error:", error.message);
    return res.status(500).json({ error: "Failed to update user." });
  }
  return res.json({ ok: true, updates });
});

// ─── GET /api/admin/support ───────────────────────────────────────────────────
// Fetch support messages for admin dashboard
app.get("/api/admin/support", requireAdminAccess, async (req, res) => {

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

// ─── GET /api/admin/usage ────────────────────────────────────────────────────
// Returns top job-title analytics. Requires admin access.
app.get("/api/admin/usage", requireAdminAccess, async (req, res) => {
  try {
    let { data, error } = await supabase
      .from("generator_usage")
      .select("normalized_job_title, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      const missingColumn = getMissingColumnName(error);
      if (missingColumn === "user_id") {
        const fallback = await supabase
          .from("generator_usage")
          .select("normalized_job_title, created_at")
          .order("created_at", { ascending: false })
          .limit(5000);
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.error("[/api/admin/usage] Supabase error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const rows = data ?? [];
    const counts = new Map();
    for (const row of rows) {
      const title = (row.normalized_job_title || "").trim();
      if (title) counts.set(title, (counts.get(title) || 0) + 1);
    }

    const topJobs = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([job, count]) => ({ job, count }));

    const recentJobs = rows.slice(0, 50).map((row) => ({
      job: (row.normalized_job_title || "").trim(),
      userId: row.user_id || null,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ totalRecords: rows.length, topJobs, recentJobs });
  } catch (err) {
    console.error("[/api/admin/usage] Unexpected error:", err.message);
    return res.status(500).json({ error: err.message });
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

app.get("/sitemap.xml", async (req, res) => {
  let blogSlugs = [];
  const { data: publishedPosts, error } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("is_published", true);

  if (!error) {
    blogSlugs = (publishedPosts || []).map((row) => row.slug).filter(Boolean);
  }

  const paths = [
    "/",
    "/blog",
    "/jobs",
    "/resume-template-builder",
    ...blogSlugs.map((slug) => `/blog/${slug}`),
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

app.get("/blog", async (req, res) => {
  let dbPosts = [];
  try {
    dbPosts = await fetchPublishedBlogPosts();
  } catch (_err) {
    // Supabase unavailable — proceed with static posts only
  }

  // Merge: DB posts override static posts with the same slug
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));
  const merged = [
    ...dbPosts,
    ...staticBlogPosts.filter((p) => !dbSlugs.has(p.slug)),
  ];

  res.send(renderBlogListPage(SITE_URL, merged));
});

app.get("/blog/:slug", async (req, res) => {
  const slug = req.params.slug;

  // 1. Try Supabase first
  let dbPost = null;
  try {
    dbPost = await fetchPublishedBlogPostBySlug(slug);
  } catch (_err) {
    // Supabase unavailable — fall through to static posts
  }

  if (dbPost) {
    return res.send(renderBlogPostPage(dbPost, SITE_URL));
  }

  // 2. Fall back to static posts
  const staticPost = staticBlogPostBySlug[slug];
  if (staticPost) {
    return res.send(renderBlogPostPage(staticPost, SITE_URL));
  }

  return res.status(404).send("Blog post not found.");
});

app.get("/resume-template-builder", (req, res) => {
  res.sendFile(path.join(process.cwd(), "resume-template-builder.html"));
});

app.get("/auth/callback", (req, res) => {
  res.sendFile(path.join(process.cwd(), "auth-callback.html"));
});

app.get("/admin-dashboard", (req, res) => {
  return res.redirect(302, "/admin");
});

function clampScore(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRoundedInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function parseFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not include valid JSON.");
  }
  return text.slice(start, end + 1);
}

function scoreToLabel(score) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Decent";
  return "Weak";
}

function hasStrongAchievementEvidence(text) {
  const value = String(text || "");
  const hasNumbers = /\b\d+(?:\.\d+)?%?\b/.test(value);
  const hasOutcomeLanguage = /(increased|reduced|improved|grew|boosted|saved|cut|achieved|delivered|exceeded|optimized|launched|won|awarded)/i.test(value);
  const hasDifferentiation = /(led|spearheaded|owned|built|designed|architected|implemented|published|mentored|trained)/i.test(value);
  return (hasNumbers && hasOutcomeLanguage) || (hasOutcomeLanguage && hasDifferentiation);
}

function hasResponsibilityHeavyBullets(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]/.test(line));

  if (lines.length === 0) return false;

  const responsibilityCount = lines.filter((line) => /(responsible for|assisted|collaborated|managed|helped|supported|worked with|handled)/i.test(line)).length;
  const outcomeCount = lines.filter((line) => /(increased|reduced|improved|grew|saved|delivered|achieved|launched|optimized|built)/i.test(line)).length;

  return responsibilityCount >= 2 && responsibilityCount > outcomeCount;
}

function detectResumeFileType(file) {
  const name = String(file?.originalname || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";

  const mime = String(file?.mimetype || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";

  return null;
}

function normalizeExtractedText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSections(payload) {
  const experience = Array.isArray(payload?.experience)
    ? payload.experience.map((item) => {
        const role = String(item?.role || "").trim();
        const bullets = Array.isArray(item?.bullets)
          ? item.bullets.map((b) => String(b || "").trim()).filter(Boolean).slice(0, 6)
          : [];
        return { role, bullets };
      }).filter((item) => item.role || item.bullets.length > 0)
    : [];

  const education = Array.isArray(payload?.education)
    ? payload.education.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const skills = Array.isArray(payload?.skills)
    ? payload.skills.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    name: String(payload?.name || "").trim(),
    contactInfo: String(payload?.contactInfo || "").trim(),
    summary: String(payload?.summary || "").trim(),
    experience,
    education,
    skills,
  };
}

function renderSectionsToPlainText(sections) {
  const parts = [];
  if (sections.name) parts.push(sections.name);
  if (sections.contactInfo) parts.push(sections.contactInfo);
  if (sections.summary) {
    parts.push("", "PROFESSIONAL SUMMARY", sections.summary);
  }

  if (sections.experience.length > 0) {
    parts.push("", "EXPERIENCE");
    sections.experience.forEach((role) => {
      if (role.role) parts.push(role.role);
      role.bullets.forEach((bullet) => parts.push(`- ${bullet}`));
      parts.push("");
    });
  }

  if (sections.education.length > 0) {
    parts.push("EDUCATION");
    sections.education.forEach((item) => parts.push(`- ${item}`));
    parts.push("");
  }

  if (sections.skills.length > 0) {
    parts.push("SKILLS");
    sections.skills.forEach((item) => parts.push(`- ${item}`));
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function buildDocxBufferFromSections(sections) {
  function parseRoleParts(roleValue) {
    const parts = String(roleValue || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      title: parts[0] || "",
      company: parts[1] || "",
      dates: parts.slice(2).join(" | ") || "",
    };
  }

  function sectionHeader(text) {
    return new Paragraph({
      spacing: { before: 300, after: 100 },
      border: {
        bottom: {
          color: "999999",
          size: 6,
        },
      },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 24,
        }),
      ],
    });
  }

  function paragraphText(text) {
    return new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: String(text || ""),
          size: 20,
        }),
      ],
    });
  }

  const children = [];

  if (sections.name) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: sections.name,
            bold: true,
            size: 36,
          }),
        ],
      })
    );
  }
  if (sections.contactInfo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: sections.contactInfo,
            size: 20,
          }),
        ],
      })
    );
  }

  if (sections.summary) {
    children.push(sectionHeader("PROFESSIONAL SUMMARY"));
    children.push(paragraphText(sections.summary));
  }

  if (sections.experience.length > 0) {
    children.push(sectionHeader("EXPERIENCE"));
    sections.experience.forEach((role) => {
      const parsedRole = parseRoleParts(role.role);
      const roleTitle = [parsedRole.title, parsedRole.company].filter(Boolean).join(" | ");
      if (role.role) {
        children.push(
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: roleTitle || role.role,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: parsedRole.dates ? `   ${parsedRole.dates}` : "",
                italics: true,
                size: 20,
              }),
            ],
          })
        );
      }
      role.bullets.forEach((bullet) => {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      });
    });
  }

  if (sections.education.length > 0) {
    children.push(sectionHeader("EDUCATION"));
    children.push(paragraphText(sections.education.join("\n")));
  }

  if (sections.skills.length > 0) {
    children.push(sectionHeader("SKILLS"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sections.skills.join(" | "),
            size: 20,
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function toSafeFileStem(nameValue) {
  const fallback = "Candidate";
  const base = String(nameValue || "").trim() || fallback;
  const cleaned = base
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function parseResumeTextToSections(resumeText) {
  const rawLines = String(resumeText || "")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const lines = rawLines.filter((line) => Boolean(line));
  if (lines.length === 0) {
    return normalizeSections({});
  }

  const sections = {
    name: lines[0] || "",
    contactInfo: lines[1] || "",
    summary: "",
    experience: [],
    education: [],
    skills: [],
  };

  let mode = "";
  let currentRole = null;

  lines.slice(2).forEach((line) => {
    const upper = line.toUpperCase();
    if (upper === "PROFESSIONAL SUMMARY") {
      mode = "summary";
      currentRole = null;
      return;
    }
    if (upper === "EXPERIENCE") {
      mode = "experience";
      currentRole = null;
      return;
    }
    if (upper === "EDUCATION") {
      mode = "education";
      currentRole = null;
      return;
    }
    if (upper === "SKILLS") {
      mode = "skills";
      currentRole = null;
      return;
    }

    if (mode === "summary") {
      sections.summary = sections.summary ? `${sections.summary} ${line}` : line;
      return;
    }

    if (mode === "experience") {
      if (/^[-*•]/.test(line)) {
        if (!currentRole) {
          currentRole = { role: "Experience", bullets: [] };
          sections.experience.push(currentRole);
        }
        currentRole.bullets.push(line.replace(/^[-*•]\s*/, ""));
        return;
      }
      currentRole = { role: line, bullets: [] };
      sections.experience.push(currentRole);
      return;
    }

    if (mode === "education") {
      sections.education.push(line.replace(/^[-*•]\s*/, ""));
      return;
    }

    if (mode === "skills") {
      line
        .split(/\s*[|•,]\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((item) => sections.skills.push(item));
    }
  });

  return normalizeSections(sections);
}

async function buildPdfBufferFromSections(sections) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      if (sections.name) {
        doc.fontSize(20).font("Helvetica-Bold").text(sections.name);
      }
      if (sections.contactInfo) {
        doc.moveDown(0.3).fontSize(11).font("Helvetica").text(sections.contactInfo);
      }

      if (sections.summary) {
        doc.moveDown().fontSize(13).font("Helvetica-Bold").text("PROFESSIONAL SUMMARY");
        doc.moveDown(0.3).fontSize(11).font("Helvetica").text(sections.summary);
      }

      if (sections.experience.length > 0) {
        doc.moveDown().fontSize(13).font("Helvetica-Bold").text("EXPERIENCE");
        sections.experience.forEach((role) => {
          if (role.role) {
            doc.moveDown(0.4).fontSize(11).font("Helvetica-Bold").text(role.role);
          }
          role.bullets.forEach((bullet) => {
            doc.fontSize(11).font("Helvetica").text(`• ${bullet}`, { indent: 12 });
          });
        });
      }

      if (sections.education.length > 0) {
        doc.moveDown().fontSize(13).font("Helvetica-Bold").text("EDUCATION");
        sections.education.forEach((item) => {
          doc.fontSize(11).font("Helvetica").text(`• ${item}`, { indent: 12 });
        });
      }

      if (sections.skills.length > 0) {
        doc.moveDown().fontSize(13).font("Helvetica-Bold").text("SKILLS");
        sections.skills.forEach((item) => {
          doc.fontSize(11).font("Helvetica").text(`• ${item}`, { indent: 12 });
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function sanitizeResumeAnalysis(payload, isEmptyResume, resumeText) {
  const raw = payload?.breakdown || {};
  const breakdown = {
    structure: clampScore(toRoundedInt(raw.structure, 55), 0, 100),
    flow: clampScore(toRoundedInt(raw.flow, 55), 0, 100),
    organization: clampScore(toRoundedInt(raw.organization, 55), 0, 100),
    grammar: clampScore(toRoundedInt(raw.grammar, 55), 0, 100),
    bulletUsage: clampScore(toRoundedInt(raw.bulletUsage, 55), 0, 100),
    bulletStrength: clampScore(toRoundedInt(raw.bulletStrength, 55), 0, 100),
    impact: clampScore(toRoundedInt(raw.impact, 55), 0, 100),
    relevance: clampScore(toRoundedInt(raw.relevance, 55), 0, 100),
  };

  const responsibilityHeavy = hasResponsibilityHeavyBullets(resumeText);
  if (responsibilityHeavy) {
    breakdown.bulletStrength = Math.min(breakdown.bulletStrength, 78);
  }

  const weightedScore = Math.round(
    breakdown.structure * 0.15 +
      breakdown.flow * 0.15 +
      breakdown.organization * 0.1 +
      breakdown.grammar * 0.1 +
      breakdown.bulletUsage * 0.1 +
      breakdown.bulletStrength * 0.15 +
      breakdown.impact * 0.15 +
      breakdown.relevance * 0.1
  );

  let score = isEmptyResume
    ? clampScore(weightedScore, 0, 39)
    : clampScore(weightedScore, 40, 100);

  if (!isEmptyResume && score > 85 && !hasStrongAchievementEvidence(resumeText)) {
    score = 85;
  }

  const improvements = Array.isArray(payload?.improvements)
    ? payload.improvements
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const fallbackImprovements = [
    "Rework experience bullets to highlight outcomes and concrete impact, not just duties.",
    "Tighten sentence structure and formatting so the resume is easier to scan quickly.",
    "Align summary and skills more closely with your target role to improve relevance.",
  ];

  return {
    score,
    label: scoreToLabel(score),
    breakdown,
    improvements: improvements.length === 3 ? improvements : fallbackImprovements,
  };
}

app.get("/check-my-resume", (req, res) => {
  res.sendFile(path.join(process.cwd(), "check-my-resume.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(process.cwd(), "about.html"));
});

app.post("/api/extract-resume-text", upload.single("resumeFile"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Resume file is required." });
    }

    const fileType = detectResumeFileType(file);
    if (!fileType) {
      return res.status(400).json({ error: "Unsupported file type. Use PDF or DOCX." });
    }

    let extractedText = "";
    if (fileType === "pdf") {
      const pdfParse = require("pdf-parse");
      const parsedPdf = await pdfParse(file.buffer);
      extractedText = normalizeExtractedText(parsedPdf.text);
    } else {
      const parsedDocx = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = normalizeExtractedText(parsedDocx.value);
    }

    if (!extractedText) {
      return res.status(400).json({ error: "Could not extract readable text from file." });
    }

    return res.status(200).json({ extractedText, fileType, fileName: file.originalname || "resume" });
  } catch (error) {
    console.error("/api/extract-resume-text error", error);
    return res.status(500).json({ error: "Failed to extract text from resume file." });
  }
});

app.post("/api/check-resume", async (req, res) => {
  try {
    const resumeText = String(req.body?.resumeText || "").trim();
    const isEmptyResume = resumeText.length === 0;

    if (isEmptyResume) {
      return res.status(200).json({
        score: 25,
        label: "Weak",
        breakdown: {
          structure: 20,
          flow: 25,
          organization: 20,
          grammar: 35,
          bulletUsage: 20,
          bulletStrength: 20,
          impact: 20,
          relevance: 25,
        },
        improvements: [
          "Paste your full resume so each section can be evaluated accurately.",
          "Add an experience section with job title, company, dates, and achievement-focused bullets.",
          "Include a clear skills section tailored to the role you are targeting.",
        ],
      });
    }

    const client = getOpenAIClient();

    const prompt = `You are a professional resume reviewer.

You must evaluate the resume step-by-step across these categories:

1. Structure
2. Flow & Readability
3. Organization
4. Grammar & Spelling
5. Bullet Point Usage
6. Bullet Point Strength
7. Impact
8. Relevance

STEP-BY-STEP ANALYSIS:
- Analyze structure
- Then flow/readability
- Then bullet usage/strength
- Then impact
- Then grammar/professionalism
- Then relevance

SCORING RULES:
- Score each category 0-100
- Be realistic and fair
- NEVER give a score below 40 unless resume is empty
- Do NOT over-penalize missing metrics
- Do NOT give scores above 85 unless the resume shows clear, specific achievements and differentiation
- Bullet points that only describe responsibilities (for example: collaborated, assisted, managed) should NOT be rated as high bullet strength
- Bullet strength must reflect specificity, uniqueness, and clarity of contribution

OUTPUT JSON ONLY:

{
  "score": number,
  "label": "Weak | Decent | Strong",
  "breakdown": {
    "structure": number,
    "flow": number,
    "organization": number,
    "grammar": number,
    "bulletUsage": number,
    "bulletStrength": number,
    "impact": number,
    "relevance": number
  },
  "improvements": [
    "Specific improvement based on the resume",
    "Second different improvement",
    "Third improvement targeting another area"
  ]
}

IMPROVEMENT RULES:
- Must be personalized to THIS resume
- Must be actionable
- Must not be generic
- Must not repeat
- Must not all focus on metrics
- Each improvement must reference a specific part of the resume (for example, summary, a specific experience section, or a bullet pattern)
- Avoid vague advice like "add measurable results" without pointing to where the issue appears

Resume:
${resumeText}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const content = String(completion.choices[0]?.message?.content || "");
    const parsed = JSON.parse(parseFirstJsonObject(content));
    const safeResult = sanitizeResumeAnalysis(parsed, false, resumeText);
    return res.status(200).json(safeResult);
  } catch (error) {
    console.error("/api/check-resume error", error);
    return res.status(500).json({ error: "Failed to analyze resume." });
  }
});

app.post("/api/fix-resume", async (req, res) => {
  try {
    const resumeText = String(req.body?.resumeText || "").trim();
    if (!resumeText) {
      return res.status(400).json({ error: "Resume text is required." });
    }

    const client = getOpenAIClient();
    const prompt = `You are a senior resume writer specializing in high-quality, competitive resumes.

Your job is NOT to simply rewrite the resume.

Your job is to UPGRADE it into a stronger, more competitive version.

UPGRADE RULES:

1. Improve bullet points:
- Replace generic phrases with more specific, contextual language
- Show scope of responsibility (for example: environment, workload, type of work)
- Avoid vague wording like "collaborated", "provided care", "assisted with"

2. Add depth WITHOUT faking data:
- If exact numbers are unknown, describe scale or context instead
- Example phrasing: "in a high-acuity emergency department" or "in a high-volume service environment"

3. Make each role feel distinct:
- Nursing roles should sound clinical and high-responsibility
- Service roles should sound fast-paced and customer-focused

4. Improve wording quality:
- Use confident, professional language
- Avoid repetition
- Vary sentence structure

5. Keep it REAL:
- Do NOT invent fake achievements or metrics
- Do NOT exaggerate beyond believable scope

FORMATTING RULES:
- Keep clean structure
- Use bullet points
- Make sections clearly separated
- Improve readability

GOAL:
The final resume should feel more competitive, more specific, more impactful, and more professional.

OUTPUT:
JSON only. Use this exact shape:
{
  "original": "original resume text",
  "improved": "full upgraded resume text",
  "changes": [
    {
      "original": "old sentence",
      "improved": "new sentence",
      "reason": "why it was improved"
    }
  ],
  "sections": {
    "name": "string",
    "contactInfo": "string",
    "summary": "string",
    "experience": [
      {
        "role": "Job Title | Company | Dates",
        "bullets": ["bullet", "bullet"]
      }
    ],
    "education": ["line", "line"],
    "skills": ["skill", "skill"]
  }
}

Resume:
${resumeText}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const content = String(completion.choices[0]?.message?.content || "");
    const parsed = JSON.parse(parseFirstJsonObject(content));
    const original = String(parsed?.original || resumeText || "").trim();
    const improvedFromModel = String(parsed?.improved || "").trim();
    const sections = normalizeSections(parsed?.sections || {});
    const improved = improvedFromModel || renderSectionsToPlainText(sections);
    const hydratedSections = sections.summary || sections.experience.length > 0
      ? sections
      : parseResumeTextToSections(improved);

    const changes = Array.isArray(parsed?.changes)
      ? parsed.changes
          .map((item) => ({
            original: String(item?.original || "").trim(),
            improved: String(item?.improved || "").trim(),
            reason: String(item?.reason || "").trim(),
          }))
          .filter((item) => item.original && item.improved && item.original !== item.improved)
          .slice(0, 30)
      : [];

    const fixedResume = String(improved || "").trim();

    if (!fixedResume || (!hydratedSections.summary && hydratedSections.experience.length === 0)) {
      return res.status(500).json({ error: "Resume optimization failed." });
    }

    return res.status(200).json({
      original,
      improved: fixedResume,
      changes,
      fixedResume,
      sections: hydratedSections,
    });
  } catch (error) {
    console.error("/api/fix-resume error", error);
    return res.status(500).json({ error: "Failed to optimize resume." });
  }
});

app.post("/api/download-optimized-resume", async (req, res) => {
  try {
    const format = String(req.body?.outputFormat || "docx").toLowerCase();
    const finalResumeText = String(req.body?.finalResumeText || "").trim();
    const incomingSections = normalizeSections(req.body?.sections || {});
    const sections = incomingSections.summary || incomingSections.experience.length > 0
      ? incomingSections
      : parseResumeTextToSections(finalResumeText);
    const fileStem = toSafeFileStem(sections.name);

    if (!sections.summary && sections.experience.length === 0) {
      return res.status(400).json({ error: "Structured resume sections are required." });
    }

    if (format === "pdf") {
      const buffer = await buildPdfBufferFromSections(sections);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileStem}_Optimized_Resume.pdf"`);
      return res.status(200).send(buffer);
    }

    const buffer = await buildDocxBufferFromSections(sections);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileStem}_Optimized_Resume.docx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("/api/download-optimized-resume error", error);
    return res.status(500).json({ error: "Failed to generate downloadable resume." });
  }
});

app.post("/api/stripe/checkout", async (req, res) => {
  try {
    if (!STRIPE_CHECK_MY_RESUME_PRICE_ID) {
      return res.status(500).json({
        error: "STRIPE_CHECK_MY_RESUME_PRICE_ID is not configured.",
      });
    }

    const stripe = getStripeClient();
    const baseUrl =
      String(process.env.NEXT_PUBLIC_BASE_URL || "").trim() ||
      String(process.env.SITE_URL || "").trim() ||
      `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: STRIPE_CHECK_MY_RESUME_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        product: "check_my_resume",
        product_id: STRIPE_CHECK_MY_RESUME_PRODUCT_ID,
      },
      success_url: `${baseUrl}/check-my-resume?paid=true`,
      cancel_url: `${baseUrl}/check-my-resume`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("/api/stripe/checkout error", error);
    return res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// ─── POST /api/resume-builder/sync-payment ───────────────────────────────────
// Called after Google OAuth sign-in. Verifies the Supabase JWT, checks has_paid,
// and sets the unlock cookie if the user has already paid.
app.post("/api/resume-builder/sync-payment", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return res.json({ isUnlocked: false });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (error || !user?.id) {
      console.error("[sync-payment] getUser error:", error?.message);
      return res.json({ isUnlocked: false });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("has_paid")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.has_paid) {
      setResumeUnlockCookie(res, user.id);
      console.log("[sync-payment] Unlock cookie set for user:", user.id);
      return res.json({ isUnlocked: true });
    }

    return res.json({ isUnlocked: false });
  } catch (err) {
    console.error("[sync-payment] Unexpected error:", err.message);
    return res.json({ isUnlocked: false });
  }
});

// Helper to clear the unlock cookie
function clearResumeUnlockCookie(res) {
  res.setHeader("Set-Cookie", `${RESUME_UNLOCK_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// ─── Resume Builder payment state + Stripe checkout ─────────────────────────
app.get("/api/resume-builder/access", async (req, res) => {
  if (DISABLE_RESUME_BUILDER_PAYWALL) return res.json({ isUnlocked: true });
  if (process.env.RESUME_TEMPLATE_BUILDER_UNLOCKED === "true") return res.json({ isUnlocked: true });

  // ── Replit Auth (always authoritative when logged in) ──
  if (req.isAuthenticated && req.isAuthenticated()) {
    const replitSub = req.user?.claims?.sub || null;
    const replitEmail = req.user?.claims?.email || null;
    console.log("[access] Replit Auth — sub:", replitSub, "email:", replitEmail);

    try {
      let profile = null;

      // 1) Check by replit_sub (fast path)
      if (replitSub) {
        const { data } = await supabase
          .from("users").select("id, has_paid").eq("replit_sub", replitSub).maybeSingle();
        profile = data;
      }

      // 2) Fallback: check by email
      if (!profile && replitEmail) {
        const { data } = await supabase
          .from("users").select("id, has_paid").ilike("email", replitEmail).maybeSingle();
        profile = data;
        // Back-fill replit_sub for next time
        if (profile?.id && replitSub) {
          supabase.from("users").update({ replit_sub: replitSub }).eq("id", profile.id)
            .then(() => {}).catch(() => {});
        }
      }

      if (profile?.has_paid) {
        setResumeUnlockCookie(res, profile.id || replitSub);
        console.log("[access] Unlocked for Replit user:", replitEmail);
        return res.json({ isUnlocked: true });
      } else {
        // User is logged in but NOT paid — clear any stale cookie
        clearResumeUnlockCookie(res);
        console.log("[access] Locked (not paid) for Replit user:", replitEmail);
        return res.json({ isUnlocked: false });
      }
    } catch (_err) {
      console.error("[access] Replit Auth DB error:", _err.message);
      return res.json({ isUnlocked: false });
    }
  }

  // ── Supabase JWT (always authoritative when provided) ──
  const authHeader = req.headers["authorization"] || "";
  const supabaseJwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (supabaseJwt) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(supabaseJwt);
      if (!error && user?.id) {
        const { data: profile } = await supabase
          .from("users").select("has_paid").eq("id", user.id).maybeSingle();
        if (profile?.has_paid) {
          setResumeUnlockCookie(res, user.id);
          return res.json({ isUnlocked: true });
        } else {
          clearResumeUnlockCookie(res);
          return res.json({ isUnlocked: false });
        }
      }
    } catch (_err) {
      // Fall through to cookie check
    }
  }

  // ── Cookie fallback (anonymous Stripe purchasers not currently logged in) ──
  if (isResumeUnlocked(req)) {
    return res.json({ isUnlocked: true });
  }

  return res.json({ isUnlocked: false });
});

app.get("/api/public-auth-config", (req, res) => {
  return res.json({
    supabaseUrl: SUPABASE_URL_PUBLIC,
    supabaseAnonKey: SUPABASE_PUBLISHABLE_KEY,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
  });
});

app.post("/api/admin/blog/generate", requireAdminAccess, async (req, res) => {
  try {
    const body = req.body;
    console.log("[/api/admin/blog/generate] Incoming request body:", body);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      console.error("[/api/admin/blog/generate] Invalid request body:", body);
      return res.status(400).json({ error: "Request body must be a JSON object." });
    }

    const topic = String(body?.topic || "").trim();
    const tone = String(body?.tone || "professional").trim() || "professional";
    const customImagePrompt = String(body?.imagePrompt || "").trim();

    if (!topic) {
      console.error("[/api/admin/blog/generate] Missing topic.");
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = [
      "Write a high-quality SEO blog post.",
      "",
      `Topic: ${topic}`,
      `Tone: ${tone}`,
      "/check-my-resume",
      "",
      "Include:",
      "- Strong title",
      "- Engaging introduction",
      "- Clear sections with headings",
      "- Bullet points where helpful",
      "- Strong conclusion",
      "- Keep it readable, valuable, and SEO-friendly",
      "",
      'Return strict JSON only with this shape: {"title":"...","content":"..."}',
    ].join("\n");

    try {
      const client = getOpenAIClient();
      const response = await client.responses.create({
        model: process.env.OPENAI_BLOG_MODEL || "gpt-5-mini",
        input: prompt,
        max_output_tokens: 2200,
      });

      const text = extractResponseText(response);
      const parsed = parseJsonPayload(text);
      const fallback = parseBlogDraftFallback(text, topic);
      const title = String(parsed?.title || fallback.title || topic).trim();
      const content = String(parsed?.content || fallback.content || "").trim();

      const imageResult = await generateBlogImageUrl(client, title || topic, customImagePrompt);

      if (!content) {
        console.error("[/api/admin/blog/generate] AI returned empty content.", {
          topic,
          rawResponse: response,
        });
        return res.status(500).json({ error: "No content generated" });
      }

      return res.status(200).json({
        title,
        content,
        image: imageResult.imageUrl,
        imagePrompt: imageResult.imagePrompt,
        imageSource: imageResult.imageSource,
      });
    } catch (error) {
      console.error("[/api/admin/blog/generate] OpenAI request failed:", error);
      return res.status(500).json({
        error: error?.message || "Blog generation failed",
      });
    }
  } catch (error) {
    console.error("[/api/admin/blog/generate] Unexpected error:", error);
    return res.status(500).json({
      error: error?.message || "Blog generation failed",
    });
  }
});

// ─── POST /api/admin/blog/post ───────────────────────────────────────────────
// Create a blog post directly (no AI generation). Supports customCreatedAt for
// backdating or future scheduling. Useful for automation and manual imports.
app.post("/api/admin/blog/post", requireAdminAccess, async (req, res) => {
  try {
    const { title, content, slug: rawSlug, image, imagePrompt, customCreatedAt } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required." });
    }

    let createdAt;
    if (customCreatedAt) {
      const parsed = new Date(customCreatedAt);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "Invalid customCreatedAt — must be a valid ISO date string." });
      }
      createdAt = parsed.toISOString();
      console.log("[/api/admin/blog/post] Using custom date override:", createdAt);
    } else {
      createdAt = new Date().toISOString();
      console.log("[/api/admin/blog/post] Using default current date:", createdAt);
    }

    const baseSlug = rawSlug
      ? String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
      : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80) || `post-${Date.now()}`;

    const payload = {
      title: String(title).trim(),
      slug: baseSlug,
      content: String(content).trim(),
      is_published: true,
      created_at: createdAt,
      image: image || null,
      image_prompt: imagePrompt || null,
    };

    // Strip unknown columns and retry automatically
    const attemptInsert = async (p) => {
      while (true) {
        const { data, error } = await supabase.from("blog_posts").insert(p).select("id, slug").single();
        if (!error) return { data, error: null };
        const col = getMissingColumnName(error);
        if (col && Object.prototype.hasOwnProperty.call(p, col)) {
          delete p[col];
          continue;
        }
        return { data: null, error };
      }
    };

    let { data, error } = await attemptInsert({ ...payload });

    // Retry with a unique suffix on slug collision
    if (error && String(error.code) === "23505") {
      ({ data, error } = await attemptInsert({ ...payload, slug: `${baseSlug}-${Date.now()}` }));
    }

    if (error) {
      console.error("[/api/admin/blog/post] Insert error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ ok: true, id: data.id, slug: data.slug, createdAt });
  } catch (err) {
    console.error("[/api/admin/blog/post] Unexpected error:", err.message);
    return res.status(500).json({ error: "Failed to create post." });
  }
});

// ─── POST /api/admin/blog/generate-auto ──────────────────────────────────────
// Manually triggers the same automated daily blog generation pipeline.
// Useful for testing and for kicking off an immediate post without waiting for
// the cron schedule. Requires admin access.
app.post("/api/admin/blog/generate-auto", requireAdminAccess, async (req, res) => {
  try {
    const { runDailyBlogGeneration } = require("../server/blogGeneratorService");
    const result = await runDailyBlogGeneration();

    if (!result.ok) {
      return res.status(500).json({ error: result.error || "Blog generation failed." });
    }

    return res.json({
      success: true,
      id: result.id,
      slug: result.slug,
      title: result.title,
      url: `/blog/${result.slug}`,
    });
  } catch (err) {
    console.error("[/api/admin/blog/generate-auto] Unexpected error:", err.message);
    return res.status(500).json({ error: err.message || "Blog generation failed." });
  }
});

// ─── GET /api/cron/blog-generate ────────────────────────────────────────────
// Vercel Cron trigger for daily automated blog generation.
// Protect with CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
app.get("/api/cron/blog-generate", async (req, res) => {
  const configuredSecret = String(process.env.CRON_SECRET || "").trim();
  const authHeader = String(req.get("authorization") || "").trim();

  if (configuredSecret) {
    const expected = `Bearer ${configuredSecret}`;
    if (authHeader !== expected) {
      return res.status(401).json({ error: "Unauthorized cron request." });
    }
  }

  try {
    const { runDailyBlogGeneration } = require("../server/blogGeneratorService");
    const result = await runDailyBlogGeneration();

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error || "Blog generation failed.",
      });
    }

    return res.status(200).json({
      ok: true,
      id: result.id,
      slug: result.slug,
      title: result.title,
      url: `/blog/${result.slug}`,
    });
  } catch (err) {
    console.error("[/api/cron/blog-generate] Unexpected error:", err.message);
    return res.status(500).json({ ok: false, error: err.message || "Blog generation failed." });
  }
});

async function resolveResumeOwnerUserId(req) {
  const replitSub = req.user && req.user.claims && req.user.claims.sub;
  const replitEmail = String((req.user && req.user.claims && req.user.claims.email) || "")
    .trim()
    .toLowerCase() || null;

  if (!replitSub && !replitEmail) {
    return null;
  }

  let profile = null;

  if (replitSub) {
    const { data, error } = await supabase
      .from("users")
      .select("id, replit_sub, email")
      .eq("replit_sub", replitSub)
      .maybeSingle();

    if (error) {
      console.error("[resume-owner] users lookup by replit_sub failed:", error.message);
      throw new Error("Failed to resolve resume owner.");
    }

    profile = data || null;
  }

  if (!profile && replitEmail) {
    const { data, error } = await supabase
      .from("users")
      .select("id, replit_sub, email")
      .ilike("email", replitEmail)
      .maybeSingle();

    if (error) {
      console.error("[resume-owner] users lookup by email failed:", error.message);
      throw new Error("Failed to resolve resume owner.");
    }

    profile = data || null;
  }

  if (!profile) {
    const insertPayload = {
      replit_sub: replitSub || null,
      email: replitEmail || null,
    };

    const { data, error } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, replit_sub, email")
      .single();

    if (error) {
      console.error("[resume-owner] users insert failed:", error.message);
      throw new Error("Failed to initialize user profile.");
    }

    profile = data;
  } else {
    const nextReplitSub = profile.replit_sub || replitSub || null;
    const nextEmail = profile.email || replitEmail || null;

    if (nextReplitSub !== profile.replit_sub || nextEmail !== profile.email) {
      const { error } = await supabase
        .from("users")
        .update({ replit_sub: nextReplitSub, email: nextEmail })
        .eq("id", profile.id);

      if (error) {
        console.error("[resume-owner] users profile backfill failed:", error.message);
      }
    }
  }

  return profile?.id || null;
}

app.get("/api/resume-builder/load-cloud", isAuthenticated, async (req, res) => {
  try {
    const userId = await resolveResumeOwnerUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("resumes")
      .select("content, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[/api/resume-builder/load-cloud] resumes lookup error:", error.message);
      return res.status(500).json({ error: "Failed to load resume." });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return res.json({ savedResume: row?.content || null, updatedAt: row?.updated_at || null });
  } catch (err) {
    console.error("[/api/resume-builder/load-cloud] unexpected error:", err?.message);
    return res.status(500).json({ error: "Failed to load resume." });
  }
});

app.post("/api/resume-builder/save-cloud", isAuthenticated, async (req, res) => {
  const payload = req.body?.payload;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "payload is required." });
  }

  const savedAtIso = new Date().toISOString();

  try {
    const userId = await resolveResumeOwnerUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingError) {
      console.error("[/api/resume-builder/save-cloud] existing resume lookup error:", existingError.message);
      return res.status(500).json({ error: "Failed to save resume." });
    }

    const existingId = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0].id : null;

    if (existingId) {
      const { error: updateError } = await supabase
        .from("resumes")
        .update({ content: payload, updated_at: savedAtIso })
        .eq("id", existingId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("[/api/resume-builder/save-cloud] resume update error:", updateError.message);
        return res.status(500).json({ error: "Failed to save resume." });
      }
    } else {
      const { error: insertError } = await supabase
        .from("resumes")
        .insert({ user_id: userId, content: payload, updated_at: savedAtIso });

      if (insertError) {
        console.error("[/api/resume-builder/save-cloud] resume insert error:", insertError.message);
        return res.status(500).json({ error: "Failed to save resume." });
      }
    }

    return res.json({ ok: true, updatedAt: savedAtIso });
  } catch (err) {
    console.error("[/api/resume-builder/save-cloud] unexpected error:", err?.message);
    return res.status(500).json({ error: "Failed to save resume." });
  }
});

app.post("/api/resume-builder/create-checkout-session", async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY is not configured.",
      });
    }

    if (!STRIPE_RESUME_BUILDER_PRICE_ID) {
      return res.status(500).json({
        error: "STRIPE_RESUME_BUILDER_PRICE_ID is not configured.",
      });
    }

    if (!STRIPE_RESUME_BUILDER_PRICE_ID.startsWith("price_")) {
      console.error(
        "[/api/resume-builder/create-checkout-session] STRIPE_PRICE_ID looks like a dollar amount, not a Stripe Price ID. " +
        "It must start with 'price_'. Find it in your Stripe Dashboard under Products > your product > Pricing."
      );
      return res.status(500).json({
        error: "STRIPE_PRICE_ID is misconfigured — it must be a Stripe Price ID starting with 'price_', not a dollar amount.",
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
      line_items: [{ price: STRIPE_RESUME_BUILDER_PRICE_ID, quantity: 1 }],
      billing_address_collection: "auto",
      success_url: `${normalizedReturnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${normalizedReturnUrl}?payment=cancelled`,
      metadata: {
        product: "resume_template_builder",
        product_id: STRIPE_RESUME_BUILDER_PRODUCT_ID,
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
  return res.sendFile(path.join(process.cwd(), "admin-dashboard.html"));
});

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
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=1" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=1" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=1" />
  <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png?v=1" />
  <link rel="shortcut icon" href="/favicon-32x32.png?v=1" />
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180x180.png?v=1" />
  <meta name="theme-color" content="#0f172a" />
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
        <a href="/blog" class="nav-link">Blog</a>
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
      <a href="/blog">Blog</a>
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
        <a href="/blog" class="nav-link">Blog</a>
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
      <a href="/blog">Blog</a>
      <a href="/#support">Contact support</a>
    </footer>
  </body>
</html>`;
}

module.exports = app;
