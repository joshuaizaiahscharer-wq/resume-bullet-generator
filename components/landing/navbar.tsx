"use client";

import Link from "next/link";
import Image from "next/image";

export default function LandingNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/new_favcon.ico?v=1"
              alt="BulletAI"
              width={32}
              height={32}
              className="h-7 w-auto object-contain rounded"
              priority
            />
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Bullet<span className="text-primary">AI</span>
            </span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              Blog
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/resume-template-builder"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
