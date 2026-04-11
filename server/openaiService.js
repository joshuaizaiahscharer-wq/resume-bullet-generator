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
Extract ONLY high-value resume keywords from this job description.

STRICT RULES:
- IGNORE generic words like:
  "work", "well", "able", "good", "create", "help", "team"
- IGNORE soft filler phrases
- ONLY return:
  - Hard skills (e.g., POS systems, mixology)
  - Tools (e.g., cash handling, inventory management)
  - Industry terms (e.g., customer service, bartending)
  - Measurable responsibilities

If the job description is simple or vague:
- Return only 3-5 meaningful keywords max
- DO NOT force 15 keywords

Return ONLY a JSON array.

Job Description:
${jobDescription}
`,
      },
    ],
    temperature: 0.3,
  });

  return parseJsonArray(response.choices?.[0]?.message?.content);
}

async function optimizeResumeBullets(jobDescription, bullets) {
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

Your goal is to rewrite resume bullet points so they naturally align with the job description.

CRITICAL RULE:
- DO NOT insert keywords into bullets
- DO NOT append phrases like:
  - "with stocked bar area"
  - "with checking ids"
  - "with processing payments"
- DO NOT force any keyword into a sentence

Instead:
- Understand the job description
- Rewrite bullets so they MATCH the responsibilities and tone naturally

WRITING RULES:
- Write like a human, not an AI
- Focus on actions and results
- Use clear, professional language
- Keep bullets concise and impactful

SMART BEHAVIOR:
- You may rewrite bullets completely
- You may combine bullets
- You may add up to 2 new bullets if important responsibilities are missing

QUALITY CHECK (MANDATORY):
If any bullet sounds unnatural, robotic, or forced -> rewrite it again

EXAMPLES:

BAD:
"Handled payments with processing payments"
"Served drinks with mixing drinks"

GOOD:
"Prepared and served a variety of alcoholic and non-alcoholic beverages"
"Checked identification and ensured responsible alcohol service"
"Managed inventory and restocked bar supplies to maintain service flow"

Return ONLY a JSON array of clean, natural resume bullet points.

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
