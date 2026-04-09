// Load environment variables for local development.
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { sendDigitalDownloadEmail } = require("../lib/email");
const { verifyShopifyWebhook, isOrderPaid } = require("../lib/shopifyWebhook");
const supabase = require("../lib/supabase");

const app = express();

// Use SITE_URL for sitemap/robots. In production, set this in Vercel env vars.
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const SHOPIFY_STORE_URL = (process.env.SHOPIFY_STORE_URL || "").replace(/\/$/, "");
const PRODUCT_DOWNLOAD_URL = process.env.PRODUCT_DOWNLOAD_URL || "";

// In-memory idempotency guard for duplicate webhook deliveries.
// Note: For multi-instance/serverless environments, replace with Redis/DB for stronger guarantees.
const processedWebhookIds = new Map();
const inFlightWebhookIds = new Set();
const WEBHOOK_ID_TTL_MS = 1000 * 60 * 60 * 24;

function pruneProcessedWebhookIds() {
  const now = Date.now();
  for (const [id, ts] of processedWebhookIds.entries()) {
    if (now - ts > WEBHOOK_ID_TTL_MS) {
      processedWebhookIds.delete(id);
    }
  }
}

function getWebhookDeliveryId(req, payload) {
  const headerId = req.get("X-Shopify-Webhook-Id");
  if (headerId) {
    return headerId;
  }

  // Fallback id when header is unavailable.
  return `order-${payload?.id || "unknown"}-${payload?.updated_at || payload?.created_at || "unknown"}`;
}

function getOrderCustomerEmail(order) {
  return (
    order?.email ||
    order?.contact_email ||
    order?.customer?.email ||
    ""
  );
}

function getProductDownloadUrl(order) {
  // v1: static URL from env.
  // Future upgrade: generate signed/expiring per-order links here.
  return PRODUCT_DOWNLOAD_URL;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());

// Shopify webhook MUST use raw body for HMAC verification.
app.post("/api/webhooks/shopify/orders", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body;
  const signature = req.get("X-Shopify-Hmac-Sha256");

  if (!verifyShopifyWebhook(rawBody, signature, process.env.SHOPIFY_WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid webhook signature.");
  }

  let order;
  try {
    order = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    return res.status(400).send("Invalid JSON payload.");
  }

  const deliveryId = getWebhookDeliveryId(req, order);
  pruneProcessedWebhookIds();

  if (processedWebhookIds.has(deliveryId) || inFlightWebhookIds.has(deliveryId)) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // Only deliver for successful paid orders.
  if (!isOrderPaid(order)) {
    return res.status(200).json({ ok: true, skipped: "order-not-paid" });
  }

  const customerEmail = getOrderCustomerEmail(order);
  if (!customerEmail) {
    return res.status(200).json({ ok: true, skipped: "missing-customer-email" });
  }

  const downloadUrl = getProductDownloadUrl(order);
  if (!downloadUrl) {
    console.error("PRODUCT_DOWNLOAD_URL is missing. Cannot send digital download email.");
    return res.status(500).json({ error: "Download URL not configured." });
  }

  try {
    inFlightWebhookIds.add(deliveryId);

    await sendDigitalDownloadEmail({
      toEmail: customerEmail,
      orderNumber: order?.name || order?.order_number || order?.id,
      productName: "Resume Template Pack",
      downloadUrl,
    });

    inFlightWebhookIds.delete(deliveryId);
    processedWebhookIds.set(deliveryId, Date.now());
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    inFlightWebhookIds.delete(deliveryId);
    console.error("Shopify webhook email error:", err.message);
    return res.status(500).json({ error: "Failed to send download email." });
  }
});

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

// ─── GET /api/test-supabase ──────────────────────────────────────────────────
// Health-check route to verify the Supabase connection is working.
// Remove or protect this route before going to production if desired.
app.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("purchases")
      .select("id, email, product, created_at")
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
    "/templates",
    "/purchase-success",
    "/purchase-cancel",
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

app.get("/templates", (req, res) => {
  res.send(renderTemplatesPage());
});

app.get("/purchase-success", (req, res) => {
  res.send(renderPurchaseResultPage({
    title: "Purchase Successful | BulletAI",
    heading: "Thanks for your purchase",
    body: "Your download link has been sent to your email.",
  }));
});

app.get("/purchase-cancel", (req, res) => {
  res.send(renderPurchaseResultPage({
    title: "Purchase Not Completed | BulletAI",
    heading: "Checkout was not completed",
    body: "No worries. You can return to the templates page and purchase any time.",
  }));
});

function renderClusterRoute(req, res, jobSlug, pageType) {
  const cluster = clusterByJobSlug[jobSlug];
  const page = cluster?.pages?.[pageType];

  if (!cluster || !page) {
    return res.status(404).send("Page not found.");
  }

  return res.send(renderClusterPage(cluster, pageType));
}

// ─── CTA helper ───────────────────────────────────────────────────────────────
function renderCta() {
  return `
    <section class="main cta-section" aria-labelledby="cta-heading">
      <div class="card cta-card">
        <div class="cta-badge">&#10022; Resume Template Pack</div>
        <h2 class="cta-title" id="cta-heading">Land more interviews with a<br/><span class="gradient-text">professionally designed template</span></h2>
        <p class="cta-desc">Clean, ATS-friendly resume templates that pair perfectly with your new bullet points. One-time purchase, instant download.</p>
        <a href="/templates" class="cta-btn">View Templates &rarr;</a>
      </div>
    </section>`;
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
${renderCta()}
    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

function renderTemplatesPage() {
  const checkoutUrl = SHOPIFY_STORE_URL || "#";

  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(
    "Resume Template Pack | BulletAI",
    "Professionally designed, ATS-friendly resume templates. One-time purchase, instant download. Built for job seekers who mean business."
  )}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/" class="nav-link">&#8592; Home</a>
    </nav>

    <header class="hero">
      <span class="badge">&#10022; Instant Download</span>
      <h1>Resume <span class="gradient-text">Template Pack</span></h1>
      <p class="hero-sub">
        ATS-friendly, professionally designed resume templates built for
        modern job seekers. Pair with your AI-generated bullet points and
        stand out from the stack.
      </p>
    </header>

    <main class="main">
      <div class="card templates-product-card">
        <div class="templates-layout">

          <!-- Product preview placeholder -->
          <div class="templates-preview" aria-hidden="true">
            <div class="templates-preview-inner">
              <div class="preview-line preview-line--title"></div>
              <div class="preview-line preview-line--sub"></div>
              <div class="preview-line"></div>
              <div class="preview-line preview-line--short"></div>
              <div class="preview-divider"></div>
              <div class="preview-line preview-line--section"></div>
              <div class="preview-line"></div>
              <div class="preview-line preview-line--short"></div>
              <div class="preview-line"></div>
            </div>
          </div>

          <!-- Product info -->
          <div class="templates-info">
            <p class="input-label">What&#39;s Included</p>
            <ul class="templates-features">
              <li>&#10003;&nbsp; 3 clean, modern resume templates</li>
              <li>&#10003;&nbsp; ATS-optimized formatting</li>
              <li>&#10003;&nbsp; .docx and Google Docs versions</li>
              <li>&#10003;&nbsp; Pairs perfectly with BulletAI</li>
              <li>&#10003;&nbsp; One-time purchase &mdash; instant download</li>
            </ul>

            <div class="templates-price">
              <span class="price-amount">$9</span>
              <span class="price-note">one-time &bull; instant download</span>
            </div>

            <div class="shopify-options">
              <p class="input-label">Buy Option A: Direct Shopify Checkout Link</p>
              <a href="${escapeHtml(checkoutUrl)}" class="cta-btn" ${SHOPIFY_STORE_URL ? "" : "aria-disabled=\"true\""}>Buy Now &rarr;</a>
              ${
                SHOPIFY_STORE_URL
                  ? ""
                  : '<p class="shopify-hint">Set SHOPIFY_STORE_URL in your environment variables to enable this button.</p>'
              }
            </div>

            <!--
            ═══════════════════════════════════════════════════════════════
            SHOPIFY BUY BUTTON (Option B)
            ─────────────────────────────────────────────────────────────
            1. Go to Shopify Admin → Sales Channels → Buy Button
            2. Create a "Buy Button" for your product
            3. Copy the embed snippet Shopify gives you
            4. Paste the snippet inside the wrapper below
            ═══════════════════════════════════════════════════════════════
            -->
            <div id="shopify-buy-btn" class="shopify-buy-btn-wrapper">
              <div id='product-component-1775724747930'></div>
              <script type="text/javascript">
              /*<![CDATA[*/
              (function () {
                var scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
                if (window.ShopifyBuy) {
                  if (window.ShopifyBuy.UI) {
                    ShopifyBuyInit();
                  } else {
                    loadScript();
                  }
                } else {
                  loadScript();
                }
                function loadScript() {
                  var script = document.createElement('script');
                  script.async = true;
                  script.src = scriptURL;
                  (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(script);
                  script.onload = ShopifyBuyInit;
                }
                function ShopifyBuyInit() {
                  var client = ShopifyBuy.buildClient({
                    domain: 'dz5m3m-e8.myshopify.com',
                    storefrontAccessToken: '3c766236ce0998319a1473b5ce12127e',
                  });
                  ShopifyBuy.UI.onReady(client).then(function (ui) {
                    ui.createComponent('product', {
                      id: '11008480051473',
                      node: document.getElementById('product-component-1775724747930'),
                      moneyFormat: '%24%7B%7Bamount%7D%7D',
                      options: {
                        "product": {
                          "styles": {
                            "product": {
                              "@media (min-width: 601px)": {
                                "max-width": "calc(25% - 20px)",
                                "margin-left": "20px",
                                "margin-bottom": "50px"
                              }
                            },
                            "button": {
                              ":hover": {
                                "background-color": "#064373"
                              },
                              "background-color": "#074a80",
                              ":focus": {
                                "background-color": "#064373"
                              },
                              "border-radius": "40px",
                              "padding-left": "64px",
                              "padding-right": "64px"
                            }
                          },
                          "text": {
                            "button": "Add to cart"
                          }
                        },
                        "productSet": {
                          "styles": {
                            "products": {
                              "@media (min-width: 601px)": {
                                "margin-left": "-20px"
                              }
                            }
                          }
                        },
                        "modalProduct": {
                          "contents": {
                            "img": false,
                            "imgWithCarousel": true,
                            "button": false,
                            "buttonWithQuantity": true
                          },
                          "styles": {
                            "product": {
                              "@media (min-width: 601px)": {
                                "max-width": "100%",
                                "margin-left": "0px",
                                "margin-bottom": "0px"
                              }
                            },
                            "button": {
                              ":hover": {
                                "background-color": "#064373"
                              },
                              "background-color": "#074a80",
                              ":focus": {
                                "background-color": "#064373"
                              },
                              "border-radius": "40px",
                              "padding-left": "64px",
                              "padding-right": "64px"
                            }
                          },
                          "text": {
                            "button": "Add to cart"
                          }
                        },
                        "option": {},
                        "cart": {
                          "styles": {
                            "button": {
                              ":hover": {
                                "background-color": "#064373"
                              },
                              "background-color": "#074a80",
                              ":focus": {
                                "background-color": "#064373"
                              },
                              "border-radius": "40px"
                            },
                            "title": {
                              "color": "#f1eeee"
                            },
                            "header": {
                              "color": "#f1eeee"
                            },
                            "lineItems": {
                              "color": "#f1eeee"
                            },
                            "subtotalText": {
                              "color": "#f1eeee"
                            },
                            "subtotal": {
                              "color": "#f1eeee"
                            },
                            "notice": {
                              "color": "#f1eeee"
                            },
                            "currency": {
                              "color": "#f1eeee"
                            },
                            "close": {
                              "color": "#f1eeee",
                              ":hover": {
                                "color": "#f1eeee"
                              }
                            },
                            "empty": {
                              "color": "#f1eeee"
                            },
                            "noteDescription": {
                              "color": "#f1eeee"
                            },
                            "discountText": {
                              "color": "#f1eeee"
                            },
                            "discountIcon": {
                              "fill": "#f1eeee"
                            },
                            "discountAmount": {
                              "color": "#f1eeee"
                            },
                            "cart": {
                              "background-color": "#041639"
                            },
                            "footer": {
                              "background-color": "#041639"
                            }
                          },
                          "text": {
                            "total": "Subtotal",
                            "button": "Checkout"
                          }
                        },
                        "toggle": {
                          "styles": {
                            "toggle": {
                              "background-color": "#074a80",
                              ":hover": {
                                "background-color": "#064373"
                              },
                              ":focus": {
                                "background-color": "#064373"
                              }
                            }
                          }
                        },
                        "lineItem": {
                          "styles": {
                            "variantTitle": {
                              "color": "#f1eeee"
                            },
                            "title": {
                              "color": "#f1eeee"
                            },
                            "price": {
                              "color": "#f1eeee"
                            },
                            "fullPrice": {
                              "color": "#f1eeee"
                            },
                            "discount": {
                              "color": "#f1eeee"
                            },
                            "discountIcon": {
                              "fill": "#f1eeee"
                            },
                            "quantity": {
                              "color": "#f1eeee"
                            },
                            "quantityIncrement": {
                              "color": "#f1eeee",
                              "border-color": "#f1eeee"
                            },
                            "quantityDecrement": {
                              "color": "#f1eeee",
                              "border-color": "#f1eeee"
                            },
                            "quantityInput": {
                              "color": "#f1eeee",
                              "border-color": "#f1eeee"
                            }
                          }
                        }
                      },
                    });
                  });
                }
              })();
              /*]]>*/
              </script>
            </div>

          </div>
        </div>
      </div>
    </main>

    <section class="main" aria-labelledby="templates-faq-heading">
      <div class="card">
        <p class="input-label" id="templates-faq-heading">FAQ</p>
        <dl class="faq-list">
          <div class="faq-item">
            <dt>What format are the templates?</dt>
            <dd>You receive both a .docx file (Microsoft Word / LibreOffice) and a shareable Google Docs link.</dd>
          </div>
          <div class="faq-item">
            <dt>Are these ATS-friendly?</dt>
            <dd>Yes. Templates use clean single-column layouts with standard headings that pass most ATS parsers.</dd>
          </div>
          <div class="faq-item">
            <dt>How do I download after purchase?</dt>
            <dd>You&#39;ll receive an instant download link via email right after checkout.</dd>
          </div>
        </dl>
      </div>
    </section>

    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

function renderPurchaseResultPage({ title, heading, body }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>${PAGE_HEAD(title, body)}
  </head>
  <body>
    <nav class="nav">
      <a href="/" class="nav-logo">&#10022; BulletAI</a>
      <a href="/templates" class="nav-link">Templates</a>
    </nav>

    <header class="hero">
      <span class="badge">&#10022; Purchase Update</span>
      <h1><span class="gradient-text">${escapeHtml(heading)}</span></h1>
      <p class="hero-sub">${escapeHtml(body)}</p>
    </header>

    <main class="main">
      <div class="card">
        <div class="job-links-grid">
          <a href="/templates">Back to Templates</a>
          <a href="/">Back to Home</a>
        </div>
      </div>
    </main>

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

${renderCta()}
    <footer class="footer">
      Built with the OpenAI API &mdash; results may vary.
    </footer>
  </body>
</html>`;
}

module.exports = app;
