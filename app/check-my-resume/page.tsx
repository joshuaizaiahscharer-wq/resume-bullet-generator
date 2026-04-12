"use client";

import { useMemo, useState } from "react";

type AnalysisResult = {
  score: number;
  label: "Weak" | "Decent" | "Strong";
  breakdown: {
    impact: number;
    clarity: number;
    structure: number;
    relevance: number;
    grammar: number;
    professionalism: number;
  };
  improvements: string[];
};

const categories: Array<{ key: keyof AnalysisResult["breakdown"]; label: string }> = [
  { key: "impact", label: "Impact" },
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "relevance", label: "Relevance" },
  { key: "grammar", label: "Grammar" },
  { key: "professionalism", label: "Professionalism" },
];

function getLabelTone(label: AnalysisResult["label"]) {
  if (label === "Strong") return "text-emerald-300 bg-emerald-500/15 border-emerald-400/35";
  if (label === "Decent") return "text-amber-200 bg-amber-500/15 border-amber-400/35";
  return "text-rose-200 bg-rose-500/15 border-rose-400/35";
}

export default function CheckMyResumePage() {
  const [resumeText, setResumeText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fixedResume, setFixedResume] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = resumeText.trim().length > 0 && !isAnalyzing;
  const canFix = Boolean(analysisResult) && !fixedResume && !isFixing;

  const titleText = useMemo(() => {
    if (fixedResume) return "Your Optimized Resume";
    return "Check My Resume";
  }, [fixedResume]);

  async function handleAnalyzeResume() {
    setError("");
    setFixedResume("");
    setIsAnalyzing(true);

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
      setError(err instanceof Error ? err.message : "Unable to analyze resume right now.");
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFixResume() {
    setError("");
    setIsFixing(true);

    try {
      const response = await fetch("/api/fix-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Resume fix failed.");
      }

      setFixedResume(String(data?.fixedResume || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to optimize resume right now.");
    } finally {
      setIsFixing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="mb-3 inline-flex rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
            Resume Evaluation + Upgrade
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{titleText}</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Analyze your resume for free, then unlock a fully optimized rewrite on the same page.
          </p>

          <div className="mt-6">
            <label htmlFor="resumeInput" className="mb-2 block text-sm font-semibold text-slate-300">
              Paste Your Resume
            </label>
            <textarea
              id="resumeInput"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your full resume here..."
              className="h-72 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyzeResume}
              disabled={!canAnalyze}
              className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Resume"}
            </button>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>
        </section>

        <section className="mt-6 space-y-6 transition-all duration-500">
          {fixedResume ? (
            <article className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 shadow-xl">
              <h2 className="text-2xl font-semibold text-white">Your Optimized Resume</h2>
              <p className="mt-2 text-sm text-emerald-100">
                Fully rewritten for stronger structure, clarity, and professional impact.
              </p>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-300/20 bg-slate-950/70 p-4 font-sans text-sm leading-6 text-slate-100">
                {fixedResume}
              </pre>
            </article>
          ) : analysisResult ? (
            <>
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold text-white">Resume Score</h2>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${getLabelTone(analysisResult.label)}`}
                  >
                    {analysisResult.score}% · {analysisResult.label}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {categories.map(({ key, label }) => {
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
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {analysisResult.improvements.slice(0, 3).map((item, idx) => (
                    <div key={`${idx}-${item.slice(0, 20)}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">Improvement {idx + 1}</p>
                      <p className="text-sm leading-6 text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-6 shadow-xl">
                <h3 className="text-2xl font-semibold text-white">Fix My Resume</h3>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-100">
                  <li>Fully rewritten resume</li>
                  <li>Strong bullet points</li>
                  <li>Improved structure and clarity</li>
                </ul>
                <button
                  type="button"
                  onClick={handleFixResume}
                  disabled={!canFix}
                  className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFixing ? "Optimizing Resume..." : "Fix My Resume →"}
                </button>
              </article>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
