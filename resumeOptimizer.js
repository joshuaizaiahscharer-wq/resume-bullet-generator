(function () {
  "use strict";

  const SYNONYM_MAP = {
    "mixing drinks": ["mix beverages", "prepare drinks"],
    "checking ids": ["verify identification", "check id"],
    "processing payments": ["handle transactions", "process payments"],
    "managing inventory": ["monitor inventory", "stock supplies"],
  };

  const BANNED_KEYWORDS = new Set([
    "work",
    "well",
    "able",
    "must",
    "include",
    "responsibilities",
  ]);

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();
  }

  function filterKeywords(keywords) {
    return (keywords || []).filter((kw) => {
      const value = normalize(kw);
      return value.length > 4 && !BANNED_KEYWORDS.has(value);
    });
  }

  function hasPartialOverlap(text, phrase) {
    const words = normalize(phrase).split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const matchWords = words.filter((word) => text.includes(word));
    return matchWords.length >= Math.ceil(words.length / 2);
  }

  function keywordMatchesText(text, keyword) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;

    if (text.includes(normalizedKeyword) || hasPartialOverlap(text, normalizedKeyword)) {
      return true;
    }

    const synonyms = SYNONYM_MAP[normalizedKeyword] || [];
    return synonyms.some(
      (synonym) => text.includes(normalize(synonym)) || hasPartialOverlap(text, synonym)
    );
  }

  function calculateMatchScore(bullets, keywords) {
    const filteredKeywords = filterKeywords(keywords);
    if (!filteredKeywords.length) return 0;

    const text = normalize((bullets || []).join(" "));
    let matchCount = 0;

    filteredKeywords.forEach((kw) => {
      if (keywordMatchesText(text, kw)) {
        matchCount++;
      }
    });

    return Math.round((matchCount / filteredKeywords.length) * 100);
  }

  function collectIncludedAndMissing(bullets, keywords) {
    const filteredKeywords = filterKeywords(keywords);
    const included = [];
    const missing = [];
    const text = normalize((bullets || []).join(" "));

    for (const keyword of filteredKeywords) {
      const exists = keywordMatchesText(text, keyword);
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
    calculateMatchScore,
    collectIncludedAndMissing,
    computeMatchScore,
    optimizeBulletsLocal,
    highlightKeywordsInText,
  };
})();
