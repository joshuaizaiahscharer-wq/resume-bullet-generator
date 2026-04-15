import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { BeforeAfterSection } from "@/components/home/BeforeAfterSection";
import { PersonasSection } from "@/components/home/PersonasSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { FAQSection } from "@/components/home/FAQSection";
import { CTASection } from "@/components/home/CTASection";

export const metadata: Metadata = {
  title: "AI Resume Bullet Generator | Improve Your Resume Fast",
  description:
    "Generate powerful resume bullet points instantly with AI. Improve your resume and get more interviews today.",
  openGraph: {
    title: "AI Resume Bullet Generator | Improve Your Resume Fast",
    description:
      "Generate powerful resume bullet points instantly with AI. Improve your resume and get more interviews today.",
    url: "https://www.myresumebullets.com/",
    siteName: "MyResumeBullets",
    type: "website",
  },
  alternates: {
    canonical: "https://www.myresumebullets.com/",
  },
};

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 md:space-y-24">
      <HeroSection />
      <HowItWorksSection />
      <BeforeAfterSection />
      <PersonasSection />
      <FeaturesSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}
