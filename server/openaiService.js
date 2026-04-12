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
  if (!text) return null;

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(normalized);
  if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
    throw new Error("Expected a JSON object from OpenAI.");
  }

  return parsed;
}

async function optimizeJobDescription(jobDescription) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_OPTIMIZER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
You are an expert recruiter.

Rewrite this job description into a clean, structured summary optimized for resume targeting.

OUTPUT FORMAT (return ONLY valid JSON):
{
  "responsibilities": ["...", "...", "...", "...", "..."],
  "skills": ["...", "...", "...", "...", "..."],
  "actionVerbs": ["...", "...", "...", "...", "..."]
}

RULES:
- responsibilities: 5–7 bullet points describing core job duties
- skills: 5–7 key skills or tools required
- actionVerbs: 5–7 strong action verbs used in the role
- Simplify wording
- Remove fluff
- Focus on what actually matters for a resume
- Use clear, professional language

Job Description:
${jobDescription}
`,
      },
    ],
    temperature: 0.3,
  });

  return parseJsonObject(response.choices?.[0]?.message?.content);
}

async function generateBulletsFromOptimizedJD(optimizedJD) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
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

Return ONLY a JSON array of 10 bullet point strings.

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
  generateBulletsFromOptimizedJD,
};
