import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: "BulletAI",
  description: "AI tools to optimize resumes and generate stronger professional content.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
    ],
  },
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
