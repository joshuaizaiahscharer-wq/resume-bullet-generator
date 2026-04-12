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
  if (label === "Strong") return "text-emerald-300 bg-emerald-500/15 border-emerald-400/35";
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
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Check My Resume</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-300">
          Paste your resume and get a professional evaluation in seconds
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur sm:p-8">
        {!isPaid ? (
          <>
            <div className="mt-1">
              <label htmlFor="resumeInput" className="mb-2 block text-sm font-semibold text-slate-300">
                Resume Input
              </label>
              <textarea
                id="resumeInput"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste your full resume here..."
                className="h-72 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyzeResume}
                disabled={!canAnalyze}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
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
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
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
                    <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">{label}</span>
                        <span className="text-slate-400">{value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-white">Top 3 Improvements</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {analysisResult.improvements.slice(0, 3).map((improvement, index) => (
                  <div key={`${index}-${improvement.slice(0, 20)}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                      Improvement {index + 1}
                    </p>
                    <p className="text-sm leading-6 text-slate-200">{improvement}</p>
                  </div>
                ))}
              </div>
          </article>

          <article className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-cyan-950/40 p-6 shadow-xl sm:p-8">
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
                className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Optimizing Resume..." : "Fix My Resume ->"}
              </button>
              {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </article>
        </section>
      ) : null}

      {isPaid ? (
        <section className="mt-6">
          <article className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">Your Optimized Resume</h2>
                <button
                  type="button"
                  onClick={handleCopyResume}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition-all hover:bg-emerald-500/20"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-300/20 bg-slate-950/70 p-4 font-sans text-sm leading-6 text-slate-100">
                {fixedResume}
              </pre>
              {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </article>
        </section>
      ) : null}
    </div>
  );
}
