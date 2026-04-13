import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const resumeText = String(body?.resumeText || "").trim();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    if (!resumeText) {
      return NextResponse.json({ error: "Resume text is required." }, { status: 400 });
    }

    const prompt = `You are a senior resume writer specializing in high-quality, competitive resumes.

  Your job is NOT to simply rewrite the resume.

  Your job is to UPGRADE it into a stronger, more competitive version.

  UPGRADE RULES:

  1. Improve bullet points:
  - Replace generic phrases with more specific, contextual language
  - Show scope of responsibility (for example: environment, workload, type of work)
  - Avoid vague wording like "collaborated", "provided care", "assisted with"

  2. Add depth WITHOUT faking data:
  - If exact numbers are unknown, describe scale or context instead
  - Example phrasing: "in a high-acuity emergency department" or "in a high-volume service environment"

  3. Make each role feel distinct:
  - Nursing roles should sound clinical and high-responsibility
  - Service roles should sound fast-paced and customer-focused

  4. Improve wording quality:
  - Use confident, professional language
  - Avoid repetition
  - Vary sentence structure

  5. Keep it REAL:
  - Do NOT invent fake achievements or metrics
  - Do NOT exaggerate beyond believable scope

  FORMATTING RULES:
  - Keep clean structure
  - Use bullet points
  - Make sections clearly separated
  - Improve readability

  GOAL:
  The final resume should feel more competitive, more specific, more impactful, and more professional.

  OUTPUT:
  Clean, well-formatted plain text resume

Resume:
${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const fixedResume = String(completion.choices[0]?.message?.content || "").trim();

    if (!fixedResume) {
      return NextResponse.json({ error: "Resume optimization failed." }, { status: 500 });
    }

    return NextResponse.json({ fixedResume }, { status: 200 });
  } catch (error) {
    console.error("fix-resume error", error);
    return NextResponse.json({ error: "Failed to optimize resume." }, { status: 500 });
  }
}
