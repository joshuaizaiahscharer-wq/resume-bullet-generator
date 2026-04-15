"use client";

import { useState } from "react";

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

const CATEGORIES: Array<{ key: keyof Breakdown; label: string }> = [
  { key: "structure", label: "Structure" },
  { key: "flow", label: "Flow & Readability" },
  { key: "organization", label: "Organization" },
  { key: "grammar", label: "Grammar & Spelling" },
  { key: "bulletUsage", label: "Bullet Point Usage" },
  { key: "bulletStrength", label: "Bullet Point Strength" },
  { key: "impact", label: "Impact" },
  { key: "relevance", label: "Relevance" },
];

const ROLE_KEYWORDS: Record<string, string[]> = {
  "software engineer": ["python", "javascript", "api", "microservices", "git", "testing", "agile", "sql", "cloud", "debugging"],
  "data analyst": ["sql", "excel", "tableau", "power bi", "dashboards", "kpi", "data cleaning", "etl", "reporting", "stakeholders"],
  "product manager": ["roadmap", "prioritization", "user research", "kpi", "cross-functional", "backlog", "launch", "strategy", "a/b testing", "analytics"],
  "project manager": ["scope", "timeline", "budget", "risk management", "stakeholder management", "agile", "scrum", "project planning", "delivery", "status reporting"],
  "marketing manager": ["seo", "sem", "campaign", "conversion", "content strategy", "email marketing", "google analytics", "lead generation", "brand", "roi"],
  "sales associate": ["customer engagement", "upselling", "cross-selling", "crm", "quota", "pipeline", "closing", "relationship building", "product knowledge", "follow-up"],
  bartender: ["customer service", "mixology", "cash handling", "inventory", "pos", "compliance", "upselling", "teamwork", "high-volume", "sanitation"],
  cashier: ["pos", "cash handling", "accuracy", "customer service", "returns", "transaction", "queue management", "reconciliation", "attention to detail", "loss prevention"],
  nurse: ["patient care", "charting", "emr", "vital signs", "medication administration", "care coordination", "triage", "infection control", "documentation", "communication"],
  teacher: ["curriculum", "classroom management", "lesson planning", "assessment", "student engagement", "differentiation", "parent communication", "data-driven instruction", "collaboration", "learning outcomes"],
};

const GENERIC_ROLE_KEYWORDS = ["results", "improved", "increased", "reduced", "collaborated", "led", "managed", "delivered", "optimized", "measurable"];

function normalizeKeywordText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRoleKeywords(roleText: string) {
  const normalized = normalizeKeywordText(roleText);
  if (!normalized) return [];

  const exact = ROLE_KEYWORDS[normalized];
  if (exact) return [...exact];

  const partial = Object.keys(ROLE_KEYWORDS).find((role) => normalized.includes(role) || role.includes(normalized));
  if (partial) return [...ROLE_KEYWORDS[partial]];
  return [...GENERIC_ROLE_KEYWORDS];
}

function getLabelStyles(label: AnalysisResult["label"]) {
  if (label === "Strong") return "text-blue-300 bg-blue-500/15 border-blue-400/35";
  if (label === "Decent") return "text-amber-200 bg-amber-500/15 border-amber-400/35";
  return "text-rose-200 bg-rose-500/15 border-rose-400/35";
}

export default function CheckMyResumePage() {
  const [resumeText, setResumeText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fixedResume, setFixedResume] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [keywordStatus, setKeywordStatus] = useState("");
  const [keywordSummary, setKeywordSummary] = useState("");
  const [matchedKeywords, setMatchedKeywords] = useState<Array<{ keyword: string; present: boolean }>>([]);

  const canAnalyze = resumeText.trim().length > 0 && !isLoading && !isPaid;
  const canFix = Boolean(analysisResult) && !isLoading && !isPaid;

  function handleFindKeywords() {
    const role = targetRole.trim();
    if (!role) {
      setKeywordStatus("Enter a target role first to search keywords.");
      setMatchedKeywords([]);
      setKeywordSummary("");
      return;
    }

    const roleKeywords = getRoleKeywords(role);
    const sourceText = normalizeKeywordText(resumeText);

    const nextKeywords = roleKeywords.map((keyword) => ({
      keyword,
      present: sourceText.includes(normalizeKeywordText(keyword)),
    }));

    const presentCount = nextKeywords.filter((item) => item.present).length;
    setKeywordStatus(`Showing recruiter keywords for ${role}.`);
    setKeywordSummary(
      sourceText
        ? `Matched ${presentCount} of ${roleKeywords.length} role keywords. Add missing keywords where accurate.`
        : "Role keyword set ready. Paste your resume to compare keyword coverage."
    );

    setMatchedKeywords([
      ...nextKeywords.filter((item) => !item.present),
      ...nextKeywords.filter((item) => item.present),
    ]);
  }

  async function handleAnalyzeResume() {
    setError("");
    setIsPaid(false);
    setFixedResume("");
    setAnalysisResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/check-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Analysis failed.");
      }

      setAnalysisResult(data as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze resume.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFixResume() {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/fix-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Resume optimization failed.");
      }

      const nextFixedResume = String(data?.fixedResume || "").trim();
      if (!nextFixedResume) {
        throw new Error("Resume optimization failed.");
      }

      setFixedResume(nextFixedResume);
      setIsPaid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to optimize resume.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyResume() {
    if (!fixedResume) return;
    try {
      await navigator.clipboard.writeText(fixedResume);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Check My Resume</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-300">
          Paste your resume and get a professional evaluation in seconds
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        {!isPaid ? (
          <>
            <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">Role Keyword Search</h2>
                <button
                  type="button"
                  onClick={handleFindKeywords}
                  className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
                >
                  Find Keywords
                </button>
              </div>
              <p className="mt-2 text-sm text-blue-100/90">
                Search recruiter keywords for your target role and compare against your resume content.
              </p>
              <input
                type="text"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleFindKeywords();
                  }
                }}
                placeholder="e.g. Data Analyst"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-black px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
              {keywordStatus ? <p className="mt-2 text-xs text-blue-200">{keywordStatus}</p> : null}
              {keywordSummary ? <p className="mt-2 text-sm text-slate-200">{keywordSummary}</p> : null}
              {matchedKeywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {matchedKeywords.map((item) => (
                    <span
                      key={`${item.keyword}-${item.present ? "present" : "missing"}`}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        item.present
                          ? "border-blue-400/40 bg-blue-500/15 text-blue-100"
                          : "border-rose-400/40 bg-rose-500/15 text-rose-100"
                      }`}
                    >
                      {item.keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-1">
              <label htmlFor="resumeInput" className="mb-2 block text-sm font-semibold text-slate-300">
                Resume Input
              </label>
              <textarea
                id="resumeInput"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste your full resume here..."
                className="h-72 w-full rounded-xl border border-slate-700 bg-black px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyzeResume}
                disabled={!canAnalyze}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Analyzing..." : "Analyze Resume"}
              </button>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-white">Your Optimized Resume</h2>
            <p className="mt-2 text-slate-300">Your resume has been fully rewritten and optimized.</p>
          </>
        )}
      </section>

      {!isPaid && analysisResult ? (
        <section className="mt-6 space-y-6">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">Resume Score</h2>
                <span className={`rounded-full border px-4 py-1 text-sm font-bold ${getLabelStyles(analysisResult.label)}`}>
                  {analysisResult.score}% ({analysisResult.label})
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {CATEGORIES.map(({ key, label }) => {
                  const value = analysisResult.breakdown[key];
                  return (
                    <div key={key} className="rounded-xl border border-slate-800 bg-black/60 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">{label}</span>
                        <span className="text-slate-400">{value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-white">Top 3 Improvements</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {analysisResult.improvements.slice(0, 3).map((improvement, index) => (
                  <div key={`${index}-${improvement.slice(0, 20)}`} className="rounded-xl border border-slate-800 bg-black/70 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-300">
                      Improvement {index + 1}
                    </p>
                    <p className="text-sm leading-6 text-slate-200">{improvement}</p>
                  </div>
                ))}
              </div>
          </article>

          <article className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-950 to-blue-950/30 p-6 shadow-xl sm:p-8">
              <h3 className="text-2xl font-bold text-white">Fix My Resume</h3>
              <p className="mt-2 text-slate-300">
                Let BulletAI fully rewrite and optimize your resume for clarity, structure, and impact.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>Strong bullet points for every role</li>
                <li>Improved structure and formatting</li>
                <li>Professional summary rewrite</li>
                <li>Clean, job-ready resume</li>
              </ul>
              <button
                type="button"
                onClick={handleFixResume}
                disabled={!canFix}
                className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Optimizing Resume..." : "Fix My Resume ->"}
              </button>
              {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </article>
        </section>
      ) : null}

      {isPaid ? (
        <section className="mt-6">
          <article className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">Your Optimized Resume</h2>
                <button
                  type="button"
                  onClick={handleCopyResume}
                  className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition-all hover:bg-blue-500/20"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-blue-400/20 bg-black/70 p-4 font-sans text-sm leading-6 text-slate-100">
                {fixedResume}
              </pre>
              {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </article>
        </section>
      ) : null}
    </div>
  );
}
