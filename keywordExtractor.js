(function () {
  "use strict";

  const STOPWORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "did", "do", "does", "doing", "down", "during",
    "each", "few", "for", "from", "further",
    "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "itself",
    "just",
    "me", "more", "most", "my", "myself",
    "no", "nor", "not", "now",
    "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
    "same", "she", "should", "so", "some", "such",
    "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
    "under", "until", "up",
    "very",
    "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would",
    "you", "your", "yours", "yourself", "yourselves",
  ]);

  const COMMON_ACTION_VERBS = new Set([
    "achieved", "analyzed", "built", "collaborated", "created", "delivered", "designed", "developed", "drove", "enhanced",
    "executed", "improved", "increased", "launched", "led", "managed", "optimized", "reduced", "resolved", "streamlined",
    "supported", "implemented", "coordinated", "automated", "mentored", "trained", "negotiated", "forecasted", "generated",
  ]);

  const KNOWN_SKILLS = [
    "salesforce", "excel", "crm", "hubspot", "sql", "python", "tableau", "power bi", "google analytics", "jira", "asana",
    "aws", "azure", "gcp", "react", "node.js", "typescript", "javascript", "project management", "agile", "scrum",
    "customer retention", "sales pipeline", "stakeholder management", "kpi", "saas", "api", "data analysis", "forecasting",
  ];

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function tokenize(text) {
    return normalizeText(text)
      .toLowerCase()
      .split(/[^a-z0-9+#.\-/]+/)
      .filter(Boolean);
  }

  function countTerms(tokens) {
    const counts = new Map();
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    return counts;
  }

  function extractPhrases(text) {
    const lower = normalizeText(text).toLowerCase();
    const phraseCounts = new Map();
    const matches = lower.match(/[a-z0-9+#.\-/]+(?:\s+[a-z0-9+#.\-/]+){1,2}/g) || [];

    for (const phrase of matches) {
      const words = phrase.split(" ");
      if (words.some((w) => STOPWORDS.has(w) || w.length < 3)) continue;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }

    return [...phraseCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([phrase]) => phrase);
  }

  function extractSkills(text) {
    const lower = normalizeText(text).toLowerCase();
    return KNOWN_SKILLS.filter((skill) => lower.includes(skill)).slice(0, 10);
  }

  function extractVerbs(tokens) {
    const verbs = [];
    const seen = new Set();

    for (const token of tokens) {
      if ((COMMON_ACTION_VERBS.has(token) || /ed$|ing$/.test(token)) && !seen.has(token) && token.length > 4) {
        verbs.push(token);
        seen.add(token);
      }
      if (verbs.length >= 10) break;
    }

    return verbs;
  }

  function extractKeywords(jobDescription, limit = 15) {
    const text = normalizeText(jobDescription);
    if (!text) {
      return {
        keywords: [],
        skills: [],
        verbs: [],
        phrases: [],
      };
    }

    const tokens = tokenize(text);
    const termCounts = countTerms(tokens);
    const frequentTerms = [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([term]) => term);

    const skills = extractSkills(text);
    const verbs = extractVerbs(tokens);
    const phrases = extractPhrases(text);

    const all = [];
    const seen = new Set();

    function pushMany(items) {
      for (const item of items) {
        const normalized = item.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          all.push(item);
        }
        if (all.length >= limit) return;
      }
    }

    pushMany(skills);
    pushMany(phrases);
    pushMany(verbs);
    pushMany(frequentTerms);

    return {
      keywords: all.slice(0, limit),
      skills,
      verbs,
      phrases,
    };
  }

  window.KeywordExtractor = {
    extractKeywords,
  };
})();
