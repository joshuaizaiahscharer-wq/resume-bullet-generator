// Automated daily blog post generator.
// Called by the node-cron job in server.js and by the
// POST /api/admin/blog/generate-auto endpoint.

const OpenAI = require("openai");
const supabase = require("../lib/supabase");

// ─── Topic pool ───────────────────────────────────────────────────────────────
// 45 career-focused topics. The service skips any that are too similar to an
// existing post title (≥ 60% keyword overlap) and picks randomly from what
// remains. Once all topics have been used the whole pool recycles.

const BLOG_TOPICS = [
  "How to Write a Resume With No Work Experience",
  "10 Resume Mistakes That Cost You the Interview",
  "How to Tailor Your Resume to a Job Description",
  "The Best Resume Format for 2026",
  "How to Use Keywords to Beat the ATS System",
  "How to Explain a Career Gap on Your Resume",
  "Resume Tips for Landing Remote Jobs",
  "How to Write Achievement-Based Resume Bullets",
  "How to Quantify Accomplishments on Your Resume",
  "Top Action Verbs That Make Your Resume Stand Out",
  "How to Write a Compelling Professional Summary for Your Resume",
  "Skills Section Best Practices for Your Resume in 2026",
  "How to Write a Cover Letter That Gets Noticed",
  "How to Write a Thank-You Email After a Job Interview",
  "How to Answer Tell Me About Yourself in an Interview",
  "Top Behavioral Interview Questions and How to Answer Them",
  "How to Use the STAR Method for Interview Answers",
  "How to Research a Company Before a Job Interview",
  "How to Negotiate Your Salary With Confidence",
  "How to Ask for a Raise at Work",
  "How to Follow Up After Submitting a Job Application",
  "How to Network Effectively for Your Job Search",
  "How to Use LinkedIn to Find a Job in 2026",
  "How to Write a LinkedIn Summary That Attracts Recruiters",
  "Top Skills Employers Look For in Candidates in 2026",
  "How to Change Careers When You Lack Direct Experience",
  "How to Write a Resume for a Career Transition",
  "What Recruiters Look for When They Scan a Resume",
  "How to Dress for a Job Interview in 2026",
  "How to Handle Multiple Job Offers at Once",
  "How to Recover From a Bad Job Interview",
  "How to Build a Portfolio for Any Industry",
  "How to Write a Functional Resume",
  "What Is an ATS and How Does It Filter Resumes",
  "How to Turn Internship Experience Into a Strong Resume",
  "How to List Certifications and Online Courses on a Resume",
  "How to Write a Professional Two-Week Notice Letter",
  "How to Use AI Tools to Improve Your Job Search",
  "Common Job Interview Red Flags to Watch Out For",
  "How to Ask for a Professional Reference",
  "How to Stay Motivated During a Long Job Search",
  "Entry-Level Resume Tips That Actually Get Callbacks",
  "How to Make Your Resume Pass a 6-Second Recruiter Scan",
  "How to Write a Resume When You Are Overqualified",
  "How to Write a Resume for a Freelance or Contract Work History",
];

// ─── String helpers ───────────────────────────────────────────────────────────

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "in", "on", "of", "and", "or", "is",
  "how", "what", "when", "your", "with", "that", "this", "it", "at", "by",
  "from", "be", "are", "was", "were", "do", "does", "did", "not", "no",
]);

function significantWords(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function isTooSimilar(candidate, existingTitle) {
  const a = significantWords(candidate);
  const b = significantWords(existingTitle);
  if (a.size === 0) return false;
  let overlap = 0;
  for (const w of a) {
    if (b.has(w)) overlap++;
  }
  return overlap / a.size >= 0.6;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getExistingPostsIndex() {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("title, slug");

  if (error) {
    console.error("[blog-cron] Could not fetch existing posts:", error.message);
    return { titles: [], slugs: [] };
  }

  const rows = data || [];
  return {
    titles: rows.map((r) => String(r.title || "")).filter(Boolean),
    slugs: rows.map((r) => String(r.slug || "")).filter(Boolean),
  };
}

// ─── Topic selection ──────────────────────────────────────────────────────────

function pickTopic(existingTitles) {
  const unused = BLOG_TOPICS.filter(
    (topic) => !existingTitles.some((existing) => isTooSimilar(topic, existing))
  );
  const pool = unused.length > 0 ? unused : BLOG_TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function ensureUniqueSlug(baseSlug, existingSlugs) {
  const slugSet = new Set(existingSlugs);
  if (!slugSet.has(baseSlug)) return baseSlug;
  let attempt = 2;
  while (slugSet.has(`${baseSlug}-${attempt}`)) attempt++;
  return `${baseSlug}-${attempt}`;
}

// ─── OpenAI generation ────────────────────────────────────────────────────────

function buildPrompt(topic) {
  return `You are an expert SEO content writer specializing in career advice, resumes, and job applications.

Write a high-quality blog post for the topic: "${topic}"

Requirements:
- Total word count: 800–1200 words
- Use clear HTML headings: <h2> for main sections, <h3> for sub-sections
- Use <ul> and <li> for bullet lists
- Keep paragraphs short (2–4 sentences)
- Include one natural internal link: <a href="/resume-template-builder">Resume Template Builder</a>
- End with a CTA paragraph: <p>Improve your resume instantly with AI — <a href="/resume-template-builder">Try the tool</a>.</p>
- Format: valid HTML using only <h2>, <h3>, <p>, <ul>, <li>, <a>
- Be practical and specific — no filler phrases, no vague claims
- Optimize for a Google featured snippet on the main question

Return ONLY a valid JSON object — no markdown fences, no extra text:
{
  "title": "SEO-optimized title (50–70 characters)",
  "meta_description": "Compelling meta description (140–160 characters)",
  "content": "Full HTML content here",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-friendly-slug-derived-from-title"
}`;
}

function parseGenerationResponse(rawText) {
  const text = String(rawText || "").trim();

  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No valid JSON object found in AI response.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeGeneratedContent(content) {
  let value = String(content || "").trim();
  value = value
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

async function generateBlogPost(topic) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_BLOG_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an SEO content writer. Always return valid JSON only with no markdown fences.",
      },
      { role: "user", content: buildPrompt(topic) },
    ],
    temperature: 0.7,
    max_tokens: 3200,
  });

  const rawText = response.choices[0]?.message?.content || "";
  const parsed = parseGenerationResponse(rawText);

  const title = String(parsed.title || topic).trim();
  const meta_description = String(parsed.meta_description || "").trim();
  const content = normalizeGeneratedContent(parsed.content || "");
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];
  const slug = slugify(String(parsed.slug || title));

  if (!content) throw new Error("AI returned empty content.");

  return { title, meta_description, content, keywords, slug };
}

function getMissingColumnName(error) {
  const message = String(error?.message || "");
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

// ─── DB save ──────────────────────────────────────────────────────────────────

async function saveBlogPost({ title, slug, content, meta_description, keywords }) {
  const payload = {
    title,
    slug,
    content,
    meta_description,
    keywords,
    is_published: true,
    created_at: new Date().toISOString(),
  };

  while (true) {
    const { data, error } = await supabase
      .from("blog_posts")
      .insert(payload)
      .select("id, slug")
      .single();

    if (!error) return data;

    const missingColumn = getMissingColumnName(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn];
      continue;
    }

    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function runDailyBlogGeneration() {
  console.log("[blog-cron] Starting daily blog generation...");

  try {
    // 1. Load existing posts to prevent duplicates
    const { titles: existingTitles, slugs: existingSlugs } =
      await getExistingPostsIndex();

    // 2. Pick a topic not already covered
    const topic = pickTopic(existingTitles);
    console.log(`[blog-cron] Selected topic: "${topic}"`);

    // 3. Generate via OpenAI — skip the day on failure
    let postData;
    try {
      postData = await generateBlogPost(topic);
      console.log(`[blog-cron] Blog generated: "${postData.title}"`);
    } catch (genErr) {
      console.error("[blog-cron] Error generating blog:", genErr.message);
      return { ok: false, error: genErr.message };
    }

    // 4. Ensure the slug is unique against existing slugs
    postData.slug = ensureUniqueSlug(
      postData.slug || slugify(postData.title),
      existingSlugs
    );

    // 5. Persist
    const saved = await saveBlogPost(postData);
    console.log(`[blog-cron] Blog saved: id=${saved.id}, slug=${saved.slug}`);

    return { ok: true, id: saved.id, slug: saved.slug, title: postData.title };
  } catch (err) {
    console.error("[blog-cron] Error generating blog:", err.message);
    return { ok: false, error: err.message };
  }
}

async function runDailyBlogGenerationForTopic(topicInput) {
  const topic = String(topicInput || "").trim();
  if (!topic) {
    return { ok: false, error: "Topic is required." };
  }

  try {
    const { titles: existingTitles, slugs: existingSlugs } =
      await getExistingPostsIndex();

    // Skip obviously duplicate topics to avoid near-identical posts.
    if (existingTitles.some((existing) => isTooSimilar(topic, existing))) {
      return {
        ok: true,
        skipped: true,
        reason: "similar topic already exists",
        topic,
      };
    }

    const postData = await generateBlogPost(topic);
    postData.slug = ensureUniqueSlug(
      postData.slug || slugify(postData.title),
      existingSlugs
    );

    const saved = await saveBlogPost(postData);
    return {
      ok: true,
      id: saved.id,
      slug: saved.slug,
      title: postData.title,
      topic,
    };
  } catch (err) {
    return { ok: false, error: err.message, topic };
  }
}

async function runSeoTopicBatch(topics) {
  const requestedTopics = Array.isArray(topics) ? topics : [];
  const normalizedTopics = requestedTopics
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const results = [];
  for (const topic of normalizedTopics) {
    // Run serially to avoid rate-limit spikes and simplify logging.
    const result = await runDailyBlogGenerationForTopic(topic);
    results.push(result);
  }

  const created = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.ok && r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;

  return {
    ok: failed === 0,
    created,
    skipped,
    failed,
    results,
  };
}

module.exports = {
  runDailyBlogGeneration,
  runDailyBlogGenerationForTopic,
  runSeoTopicBatch,
};
