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

function parseJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(normalized);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Expected a JSON object from OpenAI.");
  }

  return parsed;
}

async function optimizeJobDescription(jobDescription, options = {}) {
  const shortInput = Boolean(options.shortInput);
  const minItems = shortInput ? 3 : 5;
  const maxItems = shortInput ? 5 : 7;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_OPTIMIZER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert recruiter and return structured JSON only.",
      },
      {
        role: "user",
        content: `
You are an expert recruiter.

Rewrite this job description into a clean, structured summary optimized for resume targeting.

OUTPUT FORMAT:

1. Core Responsibilities (${minItems}-${maxItems} bullet points)
2. Key Skills (${minItems}-${maxItems} items)
3. Important Action Verbs (${minItems}-${maxItems} verbs)

RULES:
- Simplify wording
- Remove fluff
- Focus on what actually matters for a resume
- Use clear, professional language
- If the input is short or vague, keep output concise (${minItems}-${maxItems} items per section)

Return ONLY a JSON object in this shape:
{
  "coreResponsibilities": ["..."],
  "keySkills": ["..."],
  "actionVerbs": ["..."]
}

Job Description:
${jobDescription}
`,
      },
    ],
    temperature: 0.3,
  });

  const payload = parseJsonObject(response.choices?.[0]?.message?.content);
  return {
    coreResponsibilities: Array.isArray(payload.coreResponsibilities)
      ? payload.coreResponsibilities.map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems)
      : [],
    keySkills: Array.isArray(payload.keySkills)
      ? payload.keySkills.map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems)
      : [],
    actionVerbs: Array.isArray(payload.actionVerbs)
      ? payload.actionVerbs.map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems)
      : [],
  };
}

async function generateResumeBullets(optimizedJD) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_OPTIMIZER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert resume writer.",
      },
      {
        role: "user",
        content: `
You are an expert resume writer.

Using the structured job description below, generate 10 high-quality resume bullet points.

RULES:
- Use strong action verbs
- Make bullets sound natural and professional
- Focus on impact and responsibilities
- Do NOT force keywords
- Do NOT repeat phrases
- Make bullets ready to paste into a resume

Return ONLY a JSON array of bullets.

Structured Job Description:
${JSON.stringify(optimizedJD)}
`,
      },
    ],
    temperature: 0.7,
  });

  return parseJsonArray(response.choices?.[0]?.message?.content);
}

module.exports = {
  optimizeJobDescription,
  generateResumeBullets,
};
