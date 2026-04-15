import { Zap, Shield, Clock, Sparkles, FileText, Target } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Writing",
    description:
      "Advanced AI transforms your experience into compelling, professional bullet points that showcase your achievements.",
  },
  {
    icon: Shield,
    title: "ATS-Optimized",
    description:
      "Every bullet point is crafted to pass Applicant Tracking Systems with optimized keywords and formatting.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Generate professionally written resume bullets in seconds, not hours. Save time on your job search.",
  },
  {
    icon: Target,
    title: "Role-Specific",
    description:
      "Tailored suggestions based on your target industry and job title for maximum relevance.",
  },
  {
    icon: FileText,
    title: "Multiple Formats",
    description:
      "Export your optimized resume in PDF, DOCX, or plain text. Ready for any application portal.",
  },
  {
    icon: Clock,
    title: "Instant Improvements",
    description:
      "See before and after comparisons of your bullets with clear impact metrics and action verbs.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to{" "}
            <span className="text-primary">stand out</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built with the latest AI technology and resume best practices to help
            you land more interviews.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border bg-card/50 p-6 transition hover:border-primary/50 hover:bg-card"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
