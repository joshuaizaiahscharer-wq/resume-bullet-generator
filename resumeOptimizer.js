(function () {
  "use strict";

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function containsKeyword(text, keyword) {
    return normalize(text).includes(normalize(keyword));
  }

  function collectIncludedAndMissing(bullets, keywords) {
    const included = [];
    const missing = [];

    for (const keyword of keywords || []) {
      const exists = (bullets || []).some((bullet) => containsKeyword(bullet, keyword));
      if (exists) included.push(keyword);
      else missing.push(keyword);
    }

    return { included, missing };
  }

  function computeMatchScore(bullets, keywords) {
    const total = (keywords || []).length;
    if (!total) return 0;
    const { included } = collectIncludedAndMissing(bullets, keywords);
    return Math.round((included.length / total) * 100);
  }

  function optimizeBulletsLocal(bullets, keywords) {
    const sourceBullets = (bullets || []).slice();
    const { missing } = collectIncludedAndMissing(sourceBullets, keywords || []);
    if (!missing.length) return sourceBullets;

    const optimized = [];
    let cursor = 0;

    for (const bullet of sourceBullets) {
      let text = String(bullet || "").trim();
      if (!text) continue;

      if (cursor < missing.length) {
        const keyword = missing[cursor];
        if (!containsKeyword(text, keyword)) {
          if (/[.!?]$/.test(text)) {
            text = text.replace(/[.!?]$/, "");
          }
          text = `${text}, with ${keyword}.`;
        }
        cursor += 1;
      }

      optimized.push(text);
    }

    return optimized;
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
    collectIncludedAndMissing,
    computeMatchScore,
    optimizeBulletsLocal,
    highlightKeywordsInText,
  };
})();
