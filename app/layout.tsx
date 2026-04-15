import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BulletAI - AI Resume Bullet Generator",
  description: "Transform your resume with AI-powered bullet points. Get more interviews with optimized, professional content.",
  icons: {
    icon: [{ url: "/new_favcon.ico?v=1" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} bg-background`}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Navbar />
        <main className="px-4 py-8 md:px-6 md:py-12">{children}</main>
      </body>
    </html>
  );
}
