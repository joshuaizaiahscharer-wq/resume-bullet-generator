"use client";

import { useState } from "react";

const faqItems = [
  {
    question: "Is this tool free?",
    answer:
      "Yes. You can start generating improved resume bullets immediately and iterate as many times as needed while building your final resume.",
  },
  {
    question: "Does it help with ATS?",
    answer:
      "Yes. The generator is designed around ATS resume best practices like clear structure, action-focused phrasing, and keyword alignment with target job postings.",
  },
  {
    question: "Can I use it for any job?",
    answer:
      "Yes. It works across entry-level, mid-level, and senior roles. You can generate tailored resume bullet examples for nearly any job title.",
  },
  {
    question: "How is this different from ChatGPT?",
    answer:
      "BulletAI is specifically trained for resume writing with built-in best practices for ATS optimization, action verbs, and metric-driven achievements. It produces more consistent, job-ready output.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq">
      <div className="flex flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">FAQ</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Common Questions
        </h2>
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-3 md:mt-12">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full min-h-[56px] items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/50"
              >
                <span className="font-medium text-foreground pr-4">{item.question}</span>
                <svg
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
