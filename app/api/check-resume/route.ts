import OpenAI from "openai";
import { NextResponse } from "next/server";

type Breakdown = {
  impact: number;
  clarity: number;
  structure: number;
  relevance: number;
  grammar: number;
  professionalism: number;
};

type AnalysisResult = {
  score: number;
  label: "Weak" | "Decent" | "Strong";
  breakdown: Breakdown;
  improvements: string[];
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not include valid JSON.");
  }
  return text.slice(start, end + 1);
}

function scoreToLabel(score: number): "Weak" | "Decent" | "Strong" {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Decent";
  return "Weak";
}

function sanitizeAnalysis(payload: Partial<AnalysisResult>, isEmptyResume: boolean): AnalysisResult {
  const rawBreakdown = payload.breakdown || ({} as Breakdown);

  const breakdown: Breakdown = {
    impact: clamp(toInt(rawBreakdown.impact, 55), 0, 100),
    clarity: clamp(toInt(rawBreakdown.clarity, 55), 0, 100),
    structure: clamp(toInt(rawBreakdown.structure, 55), 0, 100),
    relevance: clamp(toInt(rawBreakdown.relevance, 55), 0, 100),
    grammar: clamp(toInt(rawBreakdown.grammar, 55), 0, 100),
    professionalism: clamp(toInt(rawBreakdown.professionalism, 55), 0, 100),
  };

  const weighted = Math.round(
    breakdown.impact * 0.25 +
      breakdown.clarity * 0.2 +
      breakdown.structure * 0.2 +
      breakdown.relevance * 0.15 +
      breakdown.grammar * 0.1 +
      breakdown.professionalism * 0.1,
  );

  const score = isEmptyResume ? clamp(weighted, 0, 39) : clamp(weighted, 40, 100);

  const improvements = Array.isArray(payload.improvements)
    ? payload.improvements.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  const fallbackImprovements = [
    "Rewrite your experience bullets to emphasize outcomes, responsibilities, and business impact.",
    "Improve readability with concise language and a consistent section structure across roles.",
    "Align your wording and skills to the target role so recruiters can quickly match your fit.",
  ];

  return {
    score,
    label: scoreToLabel(score),
    breakdown,
    improvements: improvements.length === 3 ? improvements : fallbackImprovements,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const resumeText = String(body?.resumeText || "").trim();
    const isEmptyResume = resumeText.length === 0;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    if (isEmptyResume) {
      return NextResponse.json(
        {
          score: 25,
          label: "Weak",
          breakdown: {
            impact: 20,
            clarity: 25,
            structure: 20,
            relevance: 20,
            grammar: 35,
            professionalism: 30,
          },
          improvements: [
            "Paste your full resume so the reviewer can evaluate each section accurately.",
            "Add an experience section with role titles, dates, and achievement-focused bullets.",
            "Include a concise skills section tailored to the jobs you are targeting.",
          ],
        },
        { status: 200 },
      );
    }

    const prompt = `You are an expert resume reviewer and career coach.

Evaluate this resume across:
- Impact (25%)
- Clarity (20%)
- Structure (20%)
- Relevance (15%)
- Grammar & Spelling (10%)
- Professionalism (10%)

RULES:
- Score each category 0-100
- Final score must be fair (never below 40 unless resume is empty)
- Do NOT base score only on metrics
- Be realistic and professional

OUTPUT ONLY JSON:
{
  "score": number,
  "label": "Weak | Decent | Strong",
  "breakdown": {
    "impact": number,
    "clarity": number,
    "structure": number,
    "relevance": number,
    "grammar": number,
    "professionalism": number
  },
  "improvements": [
    "specific improvement based on the resume",
    "specific improvement",
    "specific improvement"
  ]
}

Resume:
${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<AnalysisResult>;
    const safeResult = sanitizeAnalysis(parsed, false);

    return NextResponse.json(safeResult, { status: 200 });
  } catch (error) {
    console.error("check-resume error", error);
    return NextResponse.json(
      {
        error: "Failed to analyze resume.",
      },
      { status: 500 },
    );
  }
}
