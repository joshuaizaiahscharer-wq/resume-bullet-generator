const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseJsonArray(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array from OpenAI.");
  }

  return parsed.map((item) => String(item || "").trim()).filter(Boolean);
}

async function extractKeywords(jobDescription) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_OPTIMIZER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert in resume writing and job analysis. Your job is to convert ANY job description into standardized resume keywords.",
      },
      {
        role: "user",
        content: `
-----------------------------------
🎯 GOAL
-----------------------------------
Transform job descriptions into:
- Clean
- Reusable
- ATS-friendly resume concepts

-----------------------------------
🧠 UNIVERSAL RULES
-----------------------------------

1. DO NOT extract text directly
→ You must REWRITE everything

2. Keywords must be:
- 2–3 words ONLY
- Generalizable across industries
- Common resume language

3. Convert responsibilities into concepts:

Examples:

"serves drinks and interacts with customers"
→ "customer service"

"manages inventory and stock levels"
→ "inventory management"

"develops software applications"
→ "software development"

"analyzes data and reports insights"
→ "data analysis"

"plans marketing campaigns"
→ "campaign management"

-----------------------------------
🚫 NEVER RETURN
-----------------------------------

- Sentences
- Long phrases
- Words like:
  "responsibilities"
  "must"
  "include"
  "work"
  "provide"

- Company/org names
- Duplicates (mixing, mix, mixed)

-----------------------------------
✅ OUTPUT FORMAT
-----------------------------------

Return ONLY a JSON array (5–8 keywords max)

Example:

[
  "customer service",
  "inventory management",
  "cash handling",
  "team collaboration",
  "process optimization",
  "data analysis"
]

-----------------------------------
Job Description:
${jobDescription}
`,
      },
    ],
    temperature: 0.3,
  });

  return parseJsonArray(response.choices?.[0]?.message?.content);
}

async function optimizeResumeBullets(bullets, jobDescription) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_OPTIMIZER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert resume writer who optimizes bullets for ATS systems.",
      },
      {
        role: "user",
        content: `
You are an expert resume writer.

Rewrite the following resume bullet points so they naturally align with the job description.

CRITICAL RULES:
- DO NOT insert keywords manually
- DO NOT append phrases like:
  "with stocked bar area"
  "with mixing drinks"
  "with checking ids"
- DO NOT force any wording from the job description

Instead:
- Understand the meaning of the job description
- Rewrite bullets to match responsibilities naturally

STYLE:
- Clear, professional, human tone
- Focus on actions and impact
- Keep bullets concise

QUALITY CHECK:
If any bullet sounds unnatural or forced, rewrite it again

Return ONLY a JSON array of improved bullets.

Job Description:
${jobDescription}

Original Resume Bullets:
${JSON.stringify(bullets)}
`,
      },
    ],
    temperature: 0.7,
  });

  return parseJsonArray(response.choices?.[0]?.message?.content);
}

module.exports = {
  extractKeywords,
  optimizeResumeBullets,
};
