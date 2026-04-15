"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;

    window.gtag("config", "G-F702GZNWHB", {
      page_path: pathname,
    });
  }, [pathname]);

  return null;
}
