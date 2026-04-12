const path = require("path");
// Load environment variables for local development.
const fs = require("fs");
const dotenv = require("dotenv");
const envLocalPath = path.join(process.cwd(), ".env.local");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const supabase = require("../lib/supabase");
const { recordGeneratorUsage } = require("../lib/usageTracking");
const {
  extractKeywords: extractKeywordsWithOpenAI,
  optimizeResumeBullets,
} = require("../server/openaiService");
const {
  blogPosts: staticBlogPosts,
  blogPostBySlug: staticBlogPostBySlug,
  renderBlogListPage,
  renderBlogPostPage,
  buildExcerpt,
} = require("../lib/blogPages");

const app = express();

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
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

async function getSupabaseUserFromAuthHeader(req) {
  const authHeader = req.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1];
  if (!accessToken) return null;

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user;
  } catch (_err) {
    return null;
  }
}

async function getAdminProfileByUserId(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin] Failed to load user profile:", error.message);
    throw new Error("Failed to verify admin access.");
  }

  return data || null;
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

const KEYWORD_STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do",
  "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it",
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we",
  "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your",
  "yours", "yourself", "yourselves",
]);

function extractKeywordsFromJobDescriptionLocal(jobDescription, limit = 18) {
  const text = String(jobDescription || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return [];

  const tokens = text.split(/[^a-z0-9+#.\-/]+/).filter(Boolean);
  const counts = new Map();
  for (const token of tokens) {
    if (token.length < 3 || KEYWORD_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function filterKeywordsForScoring(keywords) {
  const replacements = {
    "processing payments": "cash handling",
    "mixing drinks": "drink preparation",
    "checking ids": "id verification",
    "managing inventory": "inventory management",
  };

  const bannedSingleWords = new Set([
    "excel", "stocked", "mixing", "checking",
    "processing", "managing", "providing",
    "standing", "bartender", "serves", "prepares",
  ]);

  const seen = new Set();

  return (Array.isArray(keywords) ? keywords : [])
    .map((kw) => {
      const normalized = String(kw || "").toLowerCase().trim();
      return replacements[normalized] || normalized;
    })
    .filter((kw) => {
      const words = kw.split(/\s+/).filter(Boolean);
      if (words.length < 2) return false;
      if (words.length > 4) return false;
      if (bannedSingleWords.has(kw)) return false;
      if (kw.length < 8) return false;
      if (
        kw.includes("responsibilities") ||
        kw.includes("must") ||
        kw.includes("include") ||
        kw.includes("under pressure") ||
        kw.includes("long periods")
      ) return false;
      if (seen.has(kw)) return false;
      seen.add(kw);
      return true;
    })
    .slice(0, 8);
}

function optimizeBulletsLocal(bullets) {
  return (Array.isArray(bullets) ? bullets : [])
    .map((bullet) => String(bullet || "").trim())
    .filter(Boolean);
}

function cleanBullets(bullets) {
  return bullets.map(bullet => {
    return bullet
      .replace(/,\s*with\s+[^.]+/gi, "")
      .replace(/">.*$/gi, "")
      .replace(/\.\./g, ".")
      .trim();
  });
}

app.post("/api/optimize-resume", async (req, res) => {
  const jobDescription = String(req.body?.jobDescription || "").trim();
  const bullets = Array.isArray(req.body?.bullets) ? req.body.bullets.map((b) => String(b || "").trim()).filter(Boolean) : [];
  const providedKeywords = Array.isArray(req.body?.keywords)
    ? req.body.keywords.map((k) => String(k || "").trim()).filter(Boolean)
    : [];

  if (!jobDescription) {
    return res.status(400).json({ error: "jobDescription is required." });
  }

  if (!bullets.length) {
    return res.status(400).json({ error: "bullets array is required." });
  }

  let keywords = providedKeywords.length ? providedKeywords.slice(0, 20) : [];

  if (!keywords.length) {
    try {
      keywords = (await extractKeywordsWithOpenAI(jobDescription)).slice(0, 20);
    } catch (_err) {
      keywords = extractKeywordsFromJobDescriptionLocal(jobDescription, 20);
    }
  }

  keywords = filterKeywordsForScoring(keywords);

  try {
    const optimizedBullets = await optimizeResumeBullets(bullets, jobDescription);
    const cleanedBullets = cleanBullets(optimizedBullets);

    if (!cleanedBullets.length) {
      throw new Error("AI returned no optimized bullets.");
    }

    return res.json({ keywords, optimizedBullets: cleanedBullets, source: "ai" });
  } catch (err) {
    const optimizedBullets = optimizeBulletsLocal(bullets);
    const cleanedBullets = cleanBullets(optimizedBullets);
    return res.json({ keywords, optimizedBullets: cleanedBullets, source: "local" });
  }
});

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
  let selectFields = "slug, title, content, created_at, image, image_prompt";
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
        description: buildExcerpt(row.content, 170),
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
  let selectFields = "slug, title, content, created_at, image, image_prompt";
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
        description: buildExcerpt(data.content, 180),
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
  const { jobTitle, jobDescription, pagePath, pageType, userId: bodyUserId } = req.body;

  if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
    return res.status(400).json({ error: "A valid jobTitle is required." });
  }

  const sanitizedTitle = jobTitle.trim().slice(0, 100);
  const sanitizedJD = typeof jobDescription === "string" ? jobDescription.trim().slice(0, 3000) : "";

  const userPrompt = sanitizedJD
    ? `Create 10 professional resume bullet points for a ${sanitizedTitle} that are specifically tailored to the following job description. Each bullet should begin with an action verb and highlight skills and responsibilities relevant to the role.\n\nJob Description:\n${sanitizedJD}`
    : `Create 10 professional resume bullet points for a ${sanitizedTitle}. Each bullet should begin with an action verb.`;

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
          content: userPrompt,
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

app.get("/admin-dashboard", (req, res) => {
  return res.redirect(302, "/admin");
});

// ─── Resume Builder payment state + Stripe checkout ─────────────────────────
app.get("/api/resume-builder/access", async (req, res) => {
  return res.json({ isUnlocked: isResumeUnlocked(req) });
});

app.get("/api/public-auth-config", (req, res) => {
  return res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: SUPABASE_PUBLISHABLE_KEY,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
  });
});

app.post("/api/admin/blog/generate", async (req, res) => {
  try {
    const body = req.body;
    console.log("[/api/admin/blog/generate] Incoming request body:", body);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      console.error("[/api/admin/blog/generate] Invalid request body:", body);
      return res.status(400).json({ error: "Request body must be a JSON object." });
    }

    const user = await getSupabaseUserFromAuthHeader(req);
    if (!user) {
      console.error("[/api/admin/blog/generate] Missing or invalid auth token.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminProfile = await getAdminProfileByUserId(user.id);
    if (!adminProfile?.is_admin) {
      console.error("[/api/admin/blog/generate] Non-admin access attempt:", user.id);
      return res.status(403).json({ error: "Admin access required." });
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

app.get("/api/resume-builder/load-cloud", async (req, res) => {
  const user = await getSupabaseUserFromAuthHeader(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const savedResume = user.user_metadata?.resume_builder_save || null;
  return res.json({ savedResume });
});

app.post("/api/resume-builder/save-cloud", async (req, res) => {
  const user = await getSupabaseUserFromAuthHeader(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body?.payload;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "payload is required." });
  }

  const mergedMetadata = {
    ...(user.user_metadata || {}),
    resume_builder_save: payload,
    resume_builder_saved_at: new Date().toISOString(),
  };

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: mergedMetadata,
  });

  if (error) {
    console.error("[/api/resume-builder/save-cloud] Supabase error:", error.message);
    return res.status(500).json({ error: "Failed to save resume." });
  }

  return res.json({ ok: true });
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
