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
        content: "You extract the most important resume keywords from job descriptions.",
      },
      {
        role: "user",
        content: `
Extract standardized resume keywords from this job description.

IMPORTANT:
Do NOT copy phrases directly from the text.

Instead:
- Convert responsibilities into clean resume concepts

RULES:
- Keywords must be 2–3 words
- Use common resume language
- Simplify wording

EXAMPLES:

INPUT:
"provides registered nursing services"
OUTPUT:
"patient care"

INPUT:
"independent nursing services"
OUTPUT:
"clinical care"

INPUT:
"performance of patient/resident care"
OUTPUT:
"patient care"

INPUT:
"regional health authority"
OUTPUT:
(IGNORE — not a skill)

GOOD OUTPUT:
[
  "patient care",
  "medication administration",
  "health assessment",
  "care coordination",
  "patient education",
  "clinical documentation"
]

BAD OUTPUT:
[
  "provides registered nursing",
  "performance patient resident care",
  "regional health authority"
]

Return ONLY a JSON array (5–8 keywords max).

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
