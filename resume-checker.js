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
    // First, try to extract weak bullets from the user's resume
    const userBullets = extractBulletsFromResume(resumeText);
    const weakBullets = identifyWeakBullets(userBullets);

    const pairs = [];

    // If we found weak bullets, improve them
    if (weakBullets.length > 0) {
      weakBullets.slice(0, 6).forEach((bullet) => {
        const improved = improveBullet(bullet);
        pairs.push({
          before: bullet,
          after: improved
        });
      });
    }

    // Fallback: use generic examples if not enough real improvements found
    if (pairs.length < 2) {
      const genericFallback = [
        {
          before: "Responsible for managing social media accounts",
          after: "Increased social media engagement by <span class='improvement-highlight'>45%</span> through strategic content planning and audience targeting"
        },
        {
          before: "Worked on various marketing projects",
          after: "Led <span class='improvement-highlight'>12+ cross-functional marketing campaigns</span>, generating <span class='improvement-highlight'>$2.3M</span> in attributed revenue"
        },
        {
          before: "Improved team productivity",
          after: "Implemented new workflow system that <span class='improvement-highlight'>reduced processing time by 35%</span> and improved team productivity"
        },
        {
          before: "Handled customer support tickets",
          after: "Resolved <span class='improvement-highlight'>95% of support tickets</span> with <span class='improvement-highlight'>4.8/5 satisfaction rating</span>"
        }
      ];

      pairs.push(...genericFallback.slice(0, 6 - pairs.length));
    }

    return pairs;
  }

  function extractBulletsFromResume(resumeText) {
    if (!resumeText) return [];

    // Split by lines and filter for potential bullet points
    const lines = resumeText.split("\n").map((line) => line.trim()).filter((line) => line.length > 10);

    // Look for lines that likely contain job duties (bullet points)
    return lines.filter((line) => {
      const startsWithBulletChar = /^[-•*→]\s/.test(line);
      const looksLikeBullet = line.length > 20 && line.length < 300;
      const notAHeading = !/^[A-Z\s]+$/.test(line);
      return (startsWithBulletChar || looksLikeBullet) && notAHeading;
    }).map((line) => line.replace(/^[-•*→]\s/, "").trim()); // Remove bullet characters
  }

  function identifyWeakBullets(bullets) {
    const weakIndicators = [
      "responsible for",
      "worked on",
      "helped with",
      "demonstrated",
      "assisted",
      "participated in",
      "was involved in",
      "managed",
      "handled",
      "was able to",
      "helped",
      "performed"
    ];

    const metricsRegex = /(\d+%|\$\d+|[0-9]+\+?(?:\s+(?:hours|days|weeks|months|years|projects|clients|users|employees|departments|teams)))/i;

    return bullets.filter((bullet) => {
      const lowerBullet = bullet.toLowerCase();
      const hasWeakPhrase = weakIndicators.some((phrase) => lowerBullet.includes(phrase));
      const lacksMetrics = !metricsRegex.test(bullet);
      return hasWeakPhrase || lacksMetrics;
    });
  }

  function improveBullet(bullet) {
    // Strong action verbs for replacements
    const verbReplacements = {
      "responsible for": "Drove",
      "worked on": "Engineered",
      "helped with": "Accelerated",
      "demonstrated": "Delivered",
      "assisted": "Enabled",
      "participated in": "Spearheaded",
      "was involved in": "Orchestrated",
      "managed": "Led",
      "handled": "Resolved",
      "was able to": "Successfully",
      "helped": "Contributed to",
      "performed": "Executed",
      "did": "Accomplished"
    };

    let improved = bullet;

    // Replace weak verbs with strong ones
    for (const [weak, strong] of Object.entries(verbReplacements)) {
      const regex = new RegExp(`\\b${weak}\\b`, "i");
      if (regex.test(improved)) {
        improved = improved.replace(regex, strong);
        break;
      }
    }

    // Check if metrics exist; if not, add placeholder metrics
    const metricsRegex = /(\d+%|\$\d+|[0-9]+\+?(?:\s+(?:hours|days|weeks|months|years|projects|clients|users|employees|departments|teams)))/i;
    if (!metricsRegex.test(improved)) {
      // Add contextual metrics based on bullet content
      if (improved.toLowerCase().includes("revenue") || improved.toLowerCase().includes("sales")) {
        improved = improved + " <span class='improvement-highlight'>increasing revenue by 25%+</span>";
      } else if (
        improved.toLowerCase().includes("time") ||
        improved.toLowerCase().includes("process") ||
        improved.toLowerCase().includes("efficiency")
      ) {
        improved = improved + " by <span class='improvement-highlight'>30%</span>";
      } else if (improved.toLowerCase().includes("team") || improved.toLowerCase().includes("people")) {
        improved = improved + " for <span class='improvement-highlight'>12+ team members</span>";
      } else if (improved.toLowerCase().includes("user") || improved.toLowerCase().includes("customer")) {
        improved = improved + " for <span class='improvement-highlight'>1000+ users/customers</span>";
      } else if (improved.toLowerCase().includes("project") || improved.toLowerCase().includes("initiative")) {
        improved = improved + ", delivering <span class='improvement-highlight'>$500K+</span> in value";
      } else {
        improved = improved + " with <span class='improvement-highlight'>measurable impact</span>";
      }
    } else {
      // Highlight existing metrics
      improved = improved.replace(metricsRegex, "<span class='improvement-highlight'>$1</span>");
    }

    return improved;
  }

  function createImprovementCard(improvement) {
    const card = document.createElement("div");
    card.className = "improvement-card";

    card.innerHTML = `
      <div class="improvement-pair">
        <div class="bullet-column">
          <div class="bullet-label">Before</div>
          <div class="bullet-before">${improvement.before}</div>
        </div>
        <div class="bullet-column">
          <div class="bullet-label">After</div>
          <div class="bullet-after">${improvement.after}</div>
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
      const feedbackListItems = Array.from(feedbackListEl.querySelectorAll("li")).map((li) => li.textContent);
      renderImprovements(feedbackListItems);

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
