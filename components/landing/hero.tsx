"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HeroSection() {
  const [resumeText, setResumeText] = useState("");

  const handleGenerate = () => {
    if (resumeText.trim()) {
      // Store the resume text and redirect to the builder
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingResumeText", resumeText);
        window.location.href = "/resume-template-builder";
      }
    }
  };

  return (
    <section className="relative min-h-screen pt-32 pb-20">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-50" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Resume Optimization</span>
          </div>

          {/* Headline */}
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Turn your resume into{" "}
            <span className="text-primary glow-text">powerful bullet points</span>{" "}
            instantly
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            Transform basic job descriptions into compelling, results-driven
            statements that get you interviews. ATS-optimized and recruiter-approved.
          </p>

          {/* Input Section */}
          <div className="mx-auto mt-12 max-w-2xl">
            <div className="glow-blue rounded-2xl border border-border bg-card p-2">
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume or job experience here..."
                className="min-h-[140px] w-full resize-none rounded-xl border-0 bg-secondary/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="px-2 text-xs text-muted-foreground">
                  Supports full resume text, job descriptions, or bullet points
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={!resumeText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate Bullets
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>ATS-optimized output</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Results in seconds</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
