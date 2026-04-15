const steps = [
  {
    number: "01",
    title: "Enter Your Experience",
    description:
      "Paste your current role details, old bullet points, or raw job duties. You can be brief and messy - the tool handles rough notes.",
  },
  {
    number: "02",
    title: "Let AI Transform It",
    description:
      "Our AI rewrites each line with stronger verbs, clearer scope, and measurable outcomes so your resume reads like impact.",
  },
  {
    number: "03",
    title: "Copy & Apply",
    description:
      "Choose your favorite versions, copy in one click, and paste directly into your resume. Tailor each application with ease.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works">
      <div className="flex flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">How It Works</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Three Simple Steps to Better Bullets
        </h2>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 md:mt-12">
        {steps.map((step) => (
          <article
            key={step.number}
            className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:bg-card/80"
          >
            <span className="text-4xl font-bold text-primary/20">{step.number}</span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
