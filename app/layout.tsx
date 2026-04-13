import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: "BulletAI",
  description: "AI tools to optimize resumes and generate stronger professional content.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-slate-100 antialiased">
        <Navbar />
        <main className="px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
