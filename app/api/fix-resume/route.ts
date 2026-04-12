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

    const prompt = `You are an expert resume writer.

Rewrite and fully optimize the resume.

GOALS:
- Improve clarity, structure, and professionalism
- Add strong bullet points for each role
- Keep everything realistic and truthful
- DO NOT invent fake experience or fake metrics

RULES:
- Use role-specific language
- Use strong action verbs
- Add 2-4 bullet points per role
- Only include numbers when realistic
- Avoid generic phrases like "responsible for"

FORMAT:

NAME
CONTACT INFO

PROFESSIONAL SUMMARY (rewritten)

EXPERIENCE
Each role:
- Job Title | Company | Dates
- 2-4 strong bullet points

EDUCATION

SKILLS

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
