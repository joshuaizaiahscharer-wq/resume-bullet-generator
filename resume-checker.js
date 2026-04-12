(function () {
  "use strict";

  const textarea = document.getElementById("resumeText");
  const analyzeBtn = document.getElementById("analyzeResumeBtn");
  const statusEl = document.getElementById("checkerStatus");
  const resultEl = document.getElementById("checkerResult");
  const scoreTitleEl = document.getElementById("scoreTitle");
  const scoreBadgeEl = document.getElementById("scoreBadge");
  const scoreProgressEl = document.getElementById("scoreProgress");
  const feedbackListEl = document.getElementById("feedbackList");
  const improvementsListEl = document.getElementById("improvementsList");
  const moreImprovementsEl = document.getElementById("moreImprovementsText");
  const improvementsBlurEl = document.getElementById("improvementsBlurmask");
  const ctaBtn = document.getElementById("rewriteCtaBtn");
  const paywallModal = document.getElementById("paywallModal");
  const paywallCloseBtn = document.getElementById("paywallCloseBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (!textarea || !analyzeBtn || !statusEl || !resultEl || !scoreTitleEl || !scoreBadgeEl || !scoreProgressEl || !feedbackListEl || !improvementsListEl || !ctaBtn || !paywallModal) {
    return;
  }

  // Store current resume text and payment status
  let currentResumeText = "";
  let paywallUnlocked = false;
  let latestFeedback = [];

  analyzeBtn.addEventListener("click", analyzeResumeHandler);
  ctaBtn.addEventListener("click", handleCtaClick);
  paywallCloseBtn.addEventListener("click", closePaywallModal);
  checkoutBtn.addEventListener("click", handleCheckout);

  // Close paywall when clicking backdrop
  paywallModal.addEventListener("click", (e) => {
    if (e.target === paywallModal.querySelector(".paywall-backdrop")) {
      closePaywallModal();
    }
  });

  async function analyzeResumeHandler() {
    const resumeText = String(textarea.value || "").trim();

    if (!resumeText) {
      showStatus("Please paste your resume first.", true);
      return;
    }

    currentResumeText = resumeText;
    analyzeBtn.disabled = true;
    showStatus("Analyzing resume...", false);

    try {
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: resumeText.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Analysis failed (${response.status}).`);
      }

      renderResult(data.score, data.feedback, data.rating, resumeText);
      showStatus("Analysis complete.", false, true);
    } catch (err) {
      showStatus(err.message || "Unable to analyze resume right now.", true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  function renderResult(score, feedback, rating, resumeText) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const safeFeedback = Array.isArray(feedback) ? feedback : [];
    const safeRating = String(rating || "").trim();

    scoreTitleEl.textContent = safeRating
      ? `Resume Score: ${safeScore}% (${safeRating})`
      : `Resume Score: ${safeScore}%`;
    scoreProgressEl.style.width = `${safeScore}%`;
    scoreProgressEl.classList.remove("strong", "decent", "needs-work");
    scoreBadgeEl.classList.remove("strong", "decent", "needs-work");
    scoreBadgeEl.textContent = safeRating || "Needs Improvement";

    if (safeScore >= 80) {
      scoreProgressEl.classList.add("strong");
      scoreBadgeEl.classList.add("strong");
    } else if (safeScore >= 60) {
      scoreProgressEl.classList.add("decent");
      scoreBadgeEl.classList.add("decent");
    } else {
      scoreProgressEl.classList.add("needs-work");
      scoreBadgeEl.classList.add("needs-work");
    }

    latestFeedback = safeFeedback;

    // Render before/after improvement cards (show 2-3, blur the rest)
    renderImprovements(safeFeedback, resumeText);

    // Render detailed feedback
    feedbackListEl.innerHTML = "";
    const items = safeFeedback.length
      ? safeFeedback
      : ["Great baseline. Add quantified impact and role-specific wins to improve further."];

    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      feedbackListEl.appendChild(li);
    });

    resultEl.classList.remove("hidden");
    resultEl.querySelector(".progress-bar")?.setAttribute("aria-valuenow", String(safeScore));
  }

  function renderImprovements(feedback, resumeText) {
    const maxVisible = 2; // Show 2-3 improvements fully
    const improvements = generateImprovementPairs(feedback, resumeText);

    improvementsListEl.innerHTML = "";

    // Add visible improvement cards
    improvements.slice(0, maxVisible).forEach((improvement) => {
      const card = createImprovementCard(improvement);
      improvementsListEl.appendChild(card);
    });

    // Show blur overlay if there are more improvements (locked by paywall)
    if (improvements.length > maxVisible) {
      const remaining = improvements.length - maxVisible;
      if (paywallUnlocked) {
        // If unlocked, show all remaining improvements
        improvements.slice(maxVisible).forEach((improvement) => {
          const card = createImprovementCard(improvement);
          improvementsListEl.appendChild(card);
        });
        improvementsBlurEl.classList.add("hidden");
      } else {
        // If locked, show blur with locked message
        moreImprovementsEl.textContent = `🔒 ${remaining} more ${remaining === 1 ? "improvement" : "improvements"} locked`;
        improvementsBlurEl.classList.remove("hidden");
      }
    } else {
      improvementsBlurEl.classList.add("hidden");
    }
  }

  function generateImprovementPairs(feedback, resumeText) {
    const experienceBullets = extractExperienceBullets(resumeText);
    const weakBullets = identifyWeakBullets(experienceBullets);
    const fallbackBullets = getFallbackBullets(experienceBullets, weakBullets);
    const candidates = [...weakBullets, ...fallbackBullets].slice(0, 6);

    return candidates
      .map((bullet) => {
        const improved = improveBullet(bullet);
        if (!improved) return null;
        return { before: bullet, after: improved };
      })
      .filter(Boolean);
  }

  function extractExperienceBullets(resumeText) {
    if (!resumeText) return [];

    const lines = String(resumeText)
      .split(/\r?\n/)
      .map((line) => line.trim());

    const bullets = [];
    let activeSection = "other";
    let underJobRole = false;

    lines.forEach((line) => {
      if (!line) {
        underJobRole = false;
        return;
      }

      const detectedSection = detectSection(line);
      if (detectedSection) {
        activeSection = detectedSection;
        underJobRole = false;
        return;
      }

      if (activeSection !== "experience") {
        return;
      }

      if (isSkippableLine(line)) {
        return;
      }

      if (isLikelyJobRoleLine(line)) {
        underJobRole = true;
        return;
      }

      const words = countWords(line);
      const isBullet = /^[-•*–—]\s+/.test(line);
      const cleaned = line.replace(/^[-•*–—]\s+/, "").trim();

      if (isBullet && words > 6) {
        bullets.push(cleaned);
        return;
      }

      // Accept sentence-like lines under a job role as implicit bullets.
      if (underJobRole && words > 6 && /[a-zA-Z]/.test(cleaned)) {
        bullets.push(cleaned);
      }
    });

    return dedupeList(bullets);
  }

  function detectSection(line) {
    const normalized = line.toLowerCase().replace(/[^a-z\s]/g, " ").trim();

    if (/^(contact|contact info|contact information)$/.test(normalized)) return "contact";
    if (/^(summary|professional summary|profile|objective|career objective)$/.test(normalized)) return "summary";
    if (/^(experience|work experience|professional experience|employment|employment history)$/.test(normalized)) return "experience";
    if (/^(education|academic background|certifications?)$/.test(normalized)) return "education";
    return null;
  }

  function isSkippableLine(line) {
    const text = String(line || "").trim();
    if (!text) return true;
    if (countWords(text) < 5) return true;
    if (text.includes("@")) return true;
    if (/(https?:\/\/|www\.|linkedin\.com)/i.test(text)) return true;
    if (/\+?\d?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) return true;
    return false;
  }

  function isLikelyJobRoleLine(line) {
    const text = String(line || "").trim();
    if (!text) return false;
    if (text.includes("@") || /(https?:\/\/|www\.|linkedin\.com)/i.test(text)) return false;
    if (/\b(education|experience|summary|objective|skills?)\b/i.test(text)) return false;
    if (/\b(19|20)\d{2}\b/.test(text)) return true;
    if (/\b(manager|engineer|analyst|assistant|specialist|coordinator|associate|director|intern)\b/i.test(text)) return true;
    return false;
  }

  function identifyWeakBullets(bullets) {
    const weakIndicators = [
      "responsible for",
      "worked on",
      "helped with",
      "demonstrated",
      "assisted",
      "participated in",
      "was involved in"
    ];

    const metricsRegex = /(\d+%|\$\d|\d+\+|\d+\s+(hours|days|weeks|months|years|projects|clients|users|employees|tickets|accounts))/i;

    return bullets.filter((bullet) => {
      const lower = bullet.toLowerCase();
      const hasWeakPhrase = weakIndicators.some((phrase) => lower.includes(phrase));
      const lacksMetrics = !metricsRegex.test(bullet);
      return hasWeakPhrase || lacksMetrics;
    });
  }

  function getFallbackBullets(allBullets, weakBullets) {
    const weakSet = new Set(weakBullets);
    return allBullets.filter((line) => !weakSet.has(line) && countWords(line) > 6);
  }

  function improveBullet(bullet) {
    const clean = String(bullet || "").replace(/^[-•*–—]\s+/, "").trim();
    if (!clean || countWords(clean) < 6 || isSkippableLine(clean)) {
      return null;
    }

    const lower = clean.toLowerCase();
    const core = clean
      .replace(/^(responsible for|worked on|helped with|demonstrated|assisted with|assisted|participated in|was involved in)\s+/i, "")
      .replace(/\.$/, "")
      .trim();

    if (!core || countWords(core) < 3) {
      return null;
    }

    const templates = [
      {
        test: /inventory|stock|warehouse|supply chain|fulfillment/i,
        verb: "Optimized",
        tail: "reducing waste by 15% and improving stock accuracy by 22%"
      },
      {
        test: /customer|client|support|service|ticket/i,
        verb: "Improved",
        tail: "raising customer satisfaction to 96% while cutting response time by 28%"
      },
      {
        test: /sales|revenue|pipeline|account/i,
        verb: "Increased",
        tail: "driving 18% revenue growth and expanding qualified pipeline by 30%"
      },
      {
        test: /social|marketing|campaign|content|brand/i,
        verb: "Scaled",
        tail: "boosting engagement by 34% and improving campaign conversion by 19%"
      },
      {
        test: /process|workflow|operations|efficiency|procedure/i,
        verb: "Streamlined",
        tail: "reducing cycle time by 21% and increasing team throughput by 17%"
      },
      {
        test: /team|staff|training|mentor|lead/i,
        verb: "Led",
        tail: "improving team productivity by 20% across 10+ contributors"
      },
      {
        test: /project|implementation|delivery|launch/i,
        verb: "Delivered",
        tail: "completing 12+ key milestones on time and reducing delivery risk by 25%"
      }
    ];

    const selected = templates.find((item) => item.test.test(lower)) || {
      verb: "Improved",
      tail: "increasing output quality by 16% and reducing rework by 14%"
    };

    const objectPhrase = normalizeObjectPhrase(core);
    if (!objectPhrase) {
      return null;
    }

    const rewritten = `${selected.verb} ${objectPhrase}, ${selected.tail}.`;
    const hasMetric = /(\d+%|\$\d|\d+\+)/.test(rewritten);
    const startsWithStrongVerb = /^(Improved|Increased|Streamlined|Led|Delivered|Scaled|Optimized)\b/.test(rewritten);
    if (!hasMetric || !startsWithStrongVerb) {
      return null;
    }

    return highlightMetrics(rewritten);
  }

  function normalizeObjectPhrase(text) {
    let phrase = String(text || "")
      .replace(/^(managing|handling|working on|helping with|assisting with)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!phrase) return "key responsibilities";

    // Remove trailing connectors that create awkward rewrites.
    phrase = phrase.replace(/\b(and|with|for|to)$/i, "").trim();
    return phrase || null;
  }

  function highlightMetrics(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(\$\d[\d,.]*|\d+%|\d+\+)/g, "<span class='improvement-highlight'>$1</span>");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function countWords(line) {
    return String(line || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function dedupeList(items) {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  }

  function createImprovementCard(improvement) {
    const card = document.createElement("div");
    card.className = "improvement-card";

    const beforeText = escapeHtml(improvement.before);
    const afterText = String(improvement.after || "");

    card.innerHTML = `
      <div class="improvement-pair">
        <div class="bullet-column">
          <div class="bullet-label">Before</div>
          <div class="bullet-before">${beforeText}</div>
        </div>
        <div class="bullet-column">
          <div class="bullet-label">After</div>
          <div class="bullet-after">${afterText}</div>
        </div>
      </div>
    `;

    return card;
  }

  function handleCtaClick() {
    // Open paywall modal instead of redirecting
    openPaywallModal();
  }

  function openPaywallModal() {
    paywallModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closePaywallModal() {
    paywallModal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function handleCheckout() {
    // Simulate checkout process
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Processing...";

    // In production, integrate with Stripe/payment processor
    // For now, simulate successful payment after 1.5 seconds
    setTimeout(() => {
      paywallUnlocked = true;
      sessionStorage.setItem("checkerPaywallUnlocked", "true");

      // Re-render improvements to show all locked ones
      renderImprovements(latestFeedback, currentResumeText);

      // Close modal and show success
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Unlock Full Optimization";
      closePaywallModal();

      // Show success message
      showStatus("✨ Payment successful! All improvements unlocked.", false, true);

      // Optional: redirect to generator with resume data after brief delay
      setTimeout(() => {
        if (currentResumeText) {
          sessionStorage.setItem("resumeDataFromChecker", currentResumeText);
        }
        window.location.href = "/index.html";
      }, 1500);
    }, 1500);
  }

  // Check if paywall was previously unlocked
  (function checkPaywallStatus() {
    if (sessionStorage.getItem("checkerPaywallUnlocked") === "true") {
      paywallUnlocked = true;
    }
  })();

  function showStatus(message, isError, isSuccess) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("hidden", "error", "success");
    if (!message) {
      statusEl.classList.add("hidden");
      return;
    }

    if (isError) statusEl.classList.add("error");
    if (isSuccess) statusEl.classList.add("success");
  }
})();
