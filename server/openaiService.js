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

Instead of inserting keywords directly, your goal is to rewrite resume bullets so they ALIGN with the job description naturally.

IMPORTANT:
- Do NOT treat keywords as items that must be inserted
- Understand the meaning of the job description and reflect it in the bullets
- Only use keywords if they naturally fit the sentence
- NEVER append keywords to the end of a bullet
- NEVER use filler phrases like "with [keyword]" or "using [keyword]" unless it is clearly natural

WRITING STYLE:
- Focus on achievements and impact
- Use clear, natural, human language
- Make bullets sound like they were written by a professional, not AI

SMART RULES:
- You are allowed to IGNORE keywords that do not fit
- You are allowed to MERGE or REWRITE bullets completely
- You may add up to 2 new bullets if important concepts are missing

QUALITY CONTROL:
If a sentence sounds awkward, forced, or unnatural -> rewrite it again

BAD OUTPUT (DO NOT DO THIS):
"Improved systems with engineering"
"Developed applications with design"

GOOD OUTPUT:
"Designed and developed scalable software applications to improve system performance"
"Tested and maintained software systems to ensure reliability and efficiency"

Return ONLY a JSON array of improved bullet points.

Job Description:
${jobDescription}

Resume Bullets:
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
