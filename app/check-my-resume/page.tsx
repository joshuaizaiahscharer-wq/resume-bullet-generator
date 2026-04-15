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

function getLabelStyles(label: AnalysisResult["label"]) {
  if (label === "Strong") return "text-primary bg-primary/10 border-primary/30";
  if (label === "Decent") return "text-amber-400 bg-amber-400/10 border-amber-400/30";
  return "text-rose-400 bg-rose-400/10 border-rose-400/30";
}

function getScoreColor(value: number) {
  if (value >= 80) return "bg-primary";
  if (value >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

export default function CheckMyResumePage() {
  const [resumeText, setResumeText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fixedResume, setFixedResume] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const canAnalyze = resumeText.trim().length > 0 && !isLoading && !isPaid;
  const canFix = Boolean(analysisResult) && !isLoading && !isPaid;

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
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Header */}
      <header className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          Resume Analysis
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          Check My Resume
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Paste your resume and get a professional evaluation in seconds
        </p>
      </header>

      {/* Input Section */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        {!isPaid ? (
          <>
            <label htmlFor="resumeInput" className="mb-3 block text-sm font-medium text-foreground">
              Resume Content
            </label>
            <textarea
              id="resumeInput"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste your full resume here..."
              className="min-h-[280px] w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyzeResume}
                disabled={!canAnalyze}
                className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "Analyze Resume"
                )}
              </button>
              {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground">Your Optimized Resume</h2>
            <p className="mt-2 text-muted-foreground">Your resume has been fully rewritten and optimized.</p>
          </>
        )}
      </section>

      {/* Results Section */}
      {!isPaid && analysisResult && (
        <div className="space-y-6">
          {/* Score Card */}
          <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-foreground">Resume Score</h2>
              <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${getLabelStyles(analysisResult.label)}`}>
                {analysisResult.score}% ({analysisResult.label})
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {CATEGORIES.map(({ key, label }) => {
                const value = analysisResult.breakdown[key];
                return (
                  <div key={key} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground">{value}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${getScoreColor(value)}`}
                        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Improvements */}
          <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h3 className="text-lg font-bold text-foreground">Top Improvements</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {analysisResult.improvements.slice(0, 3).map((improvement, index) => (
                <div key={`${index}-${improvement.slice(0, 20)}`} className="rounded-xl border border-border bg-muted/30 p-4">
                  <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    #{index + 1}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{improvement}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Fix CTA */}
          <article className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
            <h3 className="text-xl font-bold text-foreground md:text-2xl">Fix My Resume</h3>
            <p className="mt-3 text-muted-foreground">
              Let BulletAI fully rewrite and optimize your resume for clarity, structure, and impact.
            </p>
            <ul className="mt-5 space-y-2">
              {["Strong bullet points for every role", "Improved structure and formatting", "Professional summary rewrite", "Clean, job-ready resume"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleFixResume}
              disabled={!canFix}
              className="mt-6 flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Optimizing Resume..." : "Fix My Resume"}
            </button>
            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
          </article>
        </div>
      )}

      {/* Fixed Resume Output */}
      {isPaid && (
        <article className="rounded-2xl border border-primary/20 bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">Your Optimized Resume</h2>
            <button
              type="button"
              onClick={handleCopyResume}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/20"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-4 font-sans text-sm leading-relaxed text-foreground">
            {fixedResume}
          </pre>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        </article>
      )}
    </div>
  );
}
