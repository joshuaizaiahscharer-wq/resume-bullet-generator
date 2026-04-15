import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import Navbar from "../components/Navbar";
import AnalyticsTracker from "../components/AnalyticsTracker";

export const metadata: Metadata = {
  title: "BulletAI",
  description: "AI tools to optimize resumes and generate stronger professional content.",
  icons: {
    icon: [
      { url: "/new_favcon.ico?v=1" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-slate-100 antialiased">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-F702GZNWHB"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-F702GZNWHB', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
        <AnalyticsTracker />
        <Navbar />
        <main className="px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
