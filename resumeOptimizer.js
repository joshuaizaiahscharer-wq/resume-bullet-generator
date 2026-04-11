(function () {
  "use strict";

  const SYNONYM_MAP = {
    "mixing drinks": ["mix beverages", "prepare cocktails"],
    "checking ids": ["verify identification", "check id"],
    "processing payments": ["handle transactions", "process payments"],
    "managing inventory": ["manage inventory", "stock supplies"],
  };

  const REPLACEMENTS = {
    "processing payments": "cash handling",
    "mixing drinks": "drink preparation",
    "checking ids": "id verification",
    "managing inventory": "inventory management",
  };

  const BANNED_SINGLE_WORDS = new Set([
    "excel",
    "stocked",
    "mixing",
    "checking",
    "processing",
    "managing",
    "providing",
    "standing",
    "bartender",
    "serves",
    "prepares",
  ]);

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();
  }

  function filterKeywords(keywords) {
    const seen = new Set();

    return (keywords || [])
      .map((kw) => {
        const normalized = normalize(kw);
        return REPLACEMENTS[normalized] || normalized;
      })
      .filter((value) => {
        const words = value.split(/\s+/).filter(Boolean);
        if (words.length < 2 || words.length > 4) return false;
        if (BANNED_SINGLE_WORDS.has(value)) return false;
        if (value.length < 8) return false;
        if (
          value.includes("responsibilities") ||
          value.includes("must") ||
          value.includes("include") ||
          value.includes("under pressure") ||
          value.includes("long periods")
        ) return false;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
  }

  function getFinalKeywords(keywords) {
    return filterKeywords(keywords).slice(0, 8);
  }

  function hasPartialOverlap(text, phrase) {
    const words = normalize(phrase).split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const matchWords = words.filter((word) => text.includes(word));
    return matchWords.length >= Math.ceil(words.length / 2);
  }

  function isMatch(text, keyword) {
    const normalizedText = normalize(text);
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;

    if (normalizedText.includes(normalizedKeyword)) {
      return true;
    }

    if (hasPartialOverlap(normalizedText, normalizedKeyword)) {
      return true;
    }

    const synonyms = SYNONYM_MAP[normalizedKeyword] || [];
    return synonyms.some(
      (synonym) => normalizedText.includes(normalize(synonym)) || hasPartialOverlap(normalizedText, synonym)
    );
  }

  function calculateMatchScore(bullets, keywords) {
    const cleanKw = getFinalKeywords(keywords);
    if (!cleanKw.length) return 0;

    const text = (bullets || []).join(" ");
    let matchCount = 0;

    cleanKw.forEach((kw) => {
      if (isMatch(text, kw)) {
        matchCount++;
      }
    });

    return Math.round((matchCount / cleanKw.length) * 100);
  }

  function collectIncludedAndMissing(bullets, keywords) {
    const cleanKw = getFinalKeywords(keywords);
    const included = [];
    const missing = [];
    const text = (bullets || []).join(" ");

    for (const keyword of cleanKw) {
      const exists = isMatch(text, keyword);
      if (exists) included.push(keyword);
      else missing.push(keyword);
    }

    return { included, missing };
  }

  function computeMatchScore(bullets, keywords) {
    return calculateMatchScore(bullets, keywords);
  }

  function optimizeBulletsLocal(bullets) {
    return (bullets || [])
      .map((bullet) => String(bullet || "").trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightKeywordsInText(text, keywords) {
    let html = escapeHtml(text);
    const sorted = (keywords || [])
      .slice()
      .sort((a, b) => b.length - a.length);

    for (const keyword of sorted) {
      if (!keyword) continue;
      const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b(${safe})\\b`, "gi");
      html = html.replace(
        regex,
        '<mark class="keyword-hit" data-keyword="$1">$1</mark>'
      );
    }

    return html;
  }

  window.ResumeOptimizer = {
    normalize,
    filterKeywords,
    getFinalKeywords,
    isMatch,
    calculateMatchScore,
    collectIncludedAndMissing,
    computeMatchScore,
    optimizeBulletsLocal,
    highlightKeywordsInText,
  };
})();
