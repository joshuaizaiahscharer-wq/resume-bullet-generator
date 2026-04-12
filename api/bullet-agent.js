const OpenAI = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for bullet generation
const SYSTEM_PROMPT = `You are an expert resume writer specializing in generating high-quality, realistic resume bullet points based on job titles.

CRITICAL RULES:
1. Always tailor bullet points to the SPECIFIC job role
2. DO NOT use generic phrases like:
   - "managed responsibilities"
   - "handled tasks"
   - "worked with team"
   - "responsible for"
   - "participated in"
3. DO NOT generate fake or random percentages (e.g., 16%, 19%, 23%)
4. Use realistic, believable metrics ONLY when appropriate:
   - Customers/guests served (e.g., 50-100 per shift)
   - Patients cared for (e.g., 10-25 per shift)
   - Appointments scheduled (e.g., 20-40 per day)
   - Money handled (e.g., $1,500-$2,500 per shift)
   - Projects completed (e.g., 3-5 per quarter)
5. If a metric is not appropriate for the role, describe impact WITHOUT numbers
6. Each bullet point MUST:
   - Start with a strong action verb (Managed, Served, Coordinated, Processed, Trained, Resolved, etc.)
   - Be specific to the role (not generic)
   - Include context (environment, workload, or responsibility)
   - Be 12-20 words long
7. Generate exactly 3 UNIQUE bullet points
8. Never repeat similar bullet structures or concepts
9. Focus on impact, volume, and role-specific outcomes

OUTPUT FORMAT - Return ONLY these 3 bullets in this exact format:
• Bullet 1
• Bullet 2
• Bullet 3

Do not include numbering, explanations, or any text outside the bullets.`;

/**
 * Generate AI-powered resume bullets for a given job title
 * @param {string} jobTitle - The job title to generate bullets for
 * @param {string} context - Optional additional context (e.g., "high-volume restaurant")
 * @returns {Promise<string[]>} Array of 3 bullet points
 */
async function generateBulletsWithAgent(jobTitle, context = "") {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const userMessage = context
      ? `Generate 3 resume bullet points for: ${jobTitle}\nContext: ${context}`
      : `Generate 3 resume bullet points for: ${jobTitle}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 500,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No response from OpenAI API");
    }

    const assistantMessage = response.choices[0].message.content;
    const bullets = parseBulletPoints(assistantMessage);

    if (bullets.length === 0) {
      throw new Error("Failed to parse bullet points from API response");
    }

    return bullets;
  } catch (error) {
    console.error(`Error generating bullets for "${jobTitle}":`, error);
    throw new Error(`Failed to generate bullets: ${error.message}`);
  }
}

/**
 * Parse bullet points from response text
 * @param {string} text - Raw API response text
 * @returns {string[]} Array of parsed bullet points
 */
function parseBulletPoints(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines
    .filter((line) => /^[•\-\*]/.test(line)) // Filter lines starting with bullet chars
    .map((line) => line.replace(/^[•\-\*]\s*/, "").trim()) // Remove bullet chars
    .filter((line) => line.length > 0)
    .slice(0, 3); // Ensure max 3 bullets
}

module.exports = {
  generateBulletsWithAgent,
  parseBulletPoints,
};

