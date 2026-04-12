import OpenAI from "openai";
import { NextResponse } from "next/server";

type Breakdown = {
  structure: number;
  flow: number;
  organization: number;
  grammar: number;
  bulletUsage: number;
  bulletStrength: number;
  impact: number;
  relevance: number;
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
  const raw = (payload.breakdown || {}) as Partial<Breakdown>;

  const breakdown: Breakdown = {
    structure: clamp(toInt(raw.structure, 55), 0, 100),
    flow: clamp(toInt(raw.flow, 55), 0, 100),
    organization: clamp(toInt(raw.organization, 55), 0, 100),
    grammar: clamp(toInt(raw.grammar, 55), 0, 100),
    bulletUsage: clamp(toInt(raw.bulletUsage, 55), 0, 100),
    bulletStrength: clamp(toInt(raw.bulletStrength, 55), 0, 100),
    impact: clamp(toInt(raw.impact, 55), 0, 100),
    relevance: clamp(toInt(raw.relevance, 55), 0, 100),
  };

  const weighted = Math.round(
    breakdown.structure * 0.15 +
      breakdown.flow * 0.15 +
      breakdown.organization * 0.1 +
      breakdown.grammar * 0.1 +
      breakdown.bulletUsage * 0.1 +
      breakdown.bulletStrength * 0.15 +
      breakdown.impact * 0.15 +
      breakdown.relevance * 0.1,
  );

  const score = isEmptyResume ? clamp(weighted, 0, 39) : clamp(weighted, 40, 100);

  const improvements = Array.isArray(payload.improvements)
    ? payload.improvements.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  const fallbackImprovements = [
    "Refine each experience section so bullets emphasize outcomes and impact instead of only responsibilities.",
    "Improve readability by tightening sentence length and keeping formatting consistent across all sections.",
    "Align your summary and skills with the exact role target so relevance is obvious within the first scan.",
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
            structure: 20,
            flow: 25,
            organization: 20,
            grammar: 35,
            bulletUsage: 20,
            bulletStrength: 20,
            impact: 20,
            relevance: 25,
          },
          improvements: [
            "Paste your complete resume so the reviewer can evaluate each section accurately.",
            "Add an experience section with role titles, dates, and achievement-focused bullets.",
            "Include a focused skills section aligned to your target role.",
          ],
        },
        { status: 200 },
      );
    }

    const prompt = `You are a professional resume reviewer.

You must evaluate the resume step-by-step across these categories:

1. Structure
2. Flow & Readability
3. Organization
4. Grammar & Spelling
5. Bullet Point Usage
6. Bullet Point Strength
7. Impact
8. Relevance

STEP-BY-STEP ANALYSIS:
- Analyze structure
- Then flow/readability
- Then bullet usage/strength
- Then impact
- Then grammar/professionalism
- Then relevance

SCORING RULES:
- Score each category 0-100
- Be realistic and fair
- NEVER give a score below 40 unless resume is empty
- Do NOT over-penalize missing metrics

OUTPUT JSON ONLY:

{
  "score": number,
  "label": "Weak | Decent | Strong",
  "breakdown": {
    "structure": number,
    "flow": number,
    "organization": number,
    "grammar": number,
    "bulletUsage": number,
    "bulletStrength": number,
    "impact": number,
    "relevance": number
  },
  "improvements": [
    "Specific improvement based on the resume",
    "Second different improvement",
    "Third improvement targeting another area"
  ]
}

IMPROVEMENT RULES:
- Must be personalized to THIS resume
- Must be actionable
- Must not be generic
- Must not repeat
- Must not all focus on metrics

Resume:
${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<AnalysisResult>;
    const safeResult = sanitizeAnalysis(parsed, isEmptyResume);

    return NextResponse.json(safeResult, { status: 200 });
  } catch (error) {
    console.error("check-resume error", error);
    return NextResponse.json({ error: "Failed to analyze resume." }, { status: 500 });
  }
}
