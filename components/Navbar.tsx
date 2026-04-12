"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/check-my-resume", label: "Check My Resume" },
  { href: "/blog", label: "Blog" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-slate-800/90 bg-slate-950/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          BulletAI
        </Link>

        <nav className="flex items-center gap-6" aria-label="Primary">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "font-semibold text-cyan-300 underline decoration-cyan-400/70 underline-offset-8"
                    : "text-slate-300 transition-colors hover:text-white"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Account
          </Link>
        </div>
      </div>
    </header>
  );
}
