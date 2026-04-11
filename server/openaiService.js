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
    Rewrite the following resume bullets to improve impact and alignment with the job.

    You are given a list of keywords. Your job is to intelligently incorporate them ONLY when they naturally fit.

    KEY RULES:
    - DO NOT force keywords into bullets
    - DO NOT just append keywords to the end of bullets
    - Rewrite bullets so keywords are smoothly integrated into the sentence
    - If a keyword does NOT fit naturally, DO NOT use it
    - You may create 1-2 NEW bullet points if important keywords are missing and relevant
    - Keep bullets concise and results-driven
    - Use strong action verbs
    - Maintain clarity and readability

    GOOD EXAMPLE:
    Before: "Helped customers with issues"
    After: "Resolved customer issues using CRM tools, improving satisfaction ratings by 20%"

    BAD EXAMPLE:
    "Helped customers with issues, CRM, Salesforce, communication"

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
