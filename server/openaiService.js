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
Extract the top 15-20 most relevant keywords from this job description.
Focus on:
- Skills
- Tools
- Certifications
- Action verbs
- Industry phrases

Return ONLY a clean JSON array like:
["CRM", "Salesforce", "customer retention"]

Job Description:
${jobDescription}
`,
      },
    ],
    temperature: 0.3,
  });

  return parseJsonArray(response.choices?.[0]?.message?.content);
}

async function optimizeResumeBullets(bullets, keywords) {
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
Rewrite the following resume bullets to improve impact and align with the job description.

You are given a list of keywords. Use them ONLY when they fit naturally within the context of the bullet.

STRICT RULES:
- NEVER force a keyword into a sentence
- NEVER add keywords using filler phrases like:
  - "with [keyword]"
  - "using [keyword]"
  - "involving [keyword]"
  UNLESS it clearly makes logical sense
- If a keyword does not fit the meaning of the bullet, DO NOT use it
- It is better to skip a keyword than to force it

NATURAL WRITING RULES:
- Rewrite the entire bullet so the keyword fits organically
- Keywords should feel like a natural part of the achievement, not an add-on
- Focus on accomplishments, impact, and clarity

SMART BEHAVIOR:
- You may create up to 2 NEW bullet points if important keywords are missing AND relevant
- Do NOT reuse the same keyword excessively
- Prioritize the most relevant keywords only

QUALITY CHECK (VERY IMPORTANT):
Before returning the result, mentally check:
- Does this sound like a real human wrote it?
- Would a recruiter find this natural and impressive?
- If anything sounds forced or awkward, rewrite it

BAD EXAMPLES (DO NOT DO THIS):
- "Improved sales with CRM"
- "Managed team using leadership"
- "Handled tasks with communication"

GOOD EXAMPLES:
- "Used Salesforce to track and improve sales pipeline performance"
- "Led a team of 5 to exceed monthly sales targets by 20%"
- "Resolved customer issues, improving retention and satisfaction scores"

Return ONLY a JSON array of improved bullet points.

Keywords:
${keywords.join(", ")}

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
