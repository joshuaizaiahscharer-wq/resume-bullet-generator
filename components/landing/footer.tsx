import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  Product: [
    { label: "Resume Builder", href: "/resume-template-builder" },
    { label: "Check My Resume", href: "/check-my-resume" },
    { label: "Pricing", href: "#pricing" },
  ],
  Resources: [
    { label: "Blog", href: "/blog" },
    { label: "Resume Tips", href: "/blog/resume-tips" },
    { label: "No Experience Guide", href: "/blog/how-to-make-a-resume-with-no-experience" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/#support" },
    { label: "Jobs", href: "/jobs" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/new_favcon.ico?v=1"
                alt="BulletAI"
                width={32}
                height={32}
                className="h-7 w-auto object-contain rounded"
              />
              <span className="text-xl font-extrabold tracking-tight text-foreground">
                Bullet<span className="text-primary">AI</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              AI-powered resume optimization to help you land more interviews.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} BulletAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
