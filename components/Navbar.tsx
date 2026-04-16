"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname === href;

    return (
      <Link
        href={href}
        className={`text-sm transition ${
          active ? "text-white font-semibold" : "text-gray-400 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="w-full border-b border-gray-800 bg-[#0B0B0F] backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/Website_Logo2.png?v=1"
            alt="AI"
            className="h-12 w-auto max-w-[220px] object-contain rounded-md bg-white px-2 py-1"
          />
        </Link>

        <div className="flex items-center gap-6">
          {navLink("/", "Home")}
          {navLink("/about", "About")}
          {navLink("/check-my-resume", "Check My Resume")}
          {navLink("/blog", "Blog")}
        </div>

        <div>
          <Link
            href="/resume-template-builder"
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-md transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
