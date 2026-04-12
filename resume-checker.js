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
    renderImprovements(safeFeedback);

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

  function renderImprovements(feedback) {
    const maxVisible = 2; // Show 2-3 improvements fully
    const improvements = generateImprovementPairs(feedback);

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

  function generateImprovementPairs(feedback) {
    // Generate before/after pairs from feedback
    // In a real scenario, this would come from the API
    const pairs = [];

    // Example improvement templates based on common feedback
    const beforeAfterMaps = [
      {
        before: "Responsible for managing social media accounts",
        after: "Increased social media engagement by 45% through strategic content planning and audience targeting"
      },
      {
        before: "Worked on various marketing projects",
        after: "Led 12+ cross-functional marketing campaigns, generating $2.3M in attributed revenue"
      },
      {
        before: "Improved team productivity",
        after: "Implemented new workflow system that <span class='improvement-highlight'>reduced processing time by 35%</span> and improved team productivity"
      },
      {
        before: "Handled customer support tickets",
        after: "Resolved 95% of customer support tickets with <span class='improvement-highlight'>4.8/5 satisfaction rating</span>, reducing resolution time"
      },
      {
        before: "Developed software features",
        after: "Developed 8+ full-stack features used by 50K+ monthly active users, improving system efficiency"
      },
      {
        before: "Assisted with project management",
        after: "Coordinated project delivery for 15+ initiatives on time and under budget, managing teams and stakeholders"
      }
    ];

    // Create pairs from feedback or use templates
    if (feedback && feedback.length > 0) {
      feedback.slice(0, 6).forEach((fb, idx) => {
        if (idx < beforeAfterMaps.length) {
          pairs.push(beforeAfterMaps[idx]);
        } else {
          pairs.push({
            before: "Generic bullet point",
            after: fb
          });
        }
      });
    } else {
      pairs.push(...beforeAfterMaps.slice(0, 4));
    }

    return pairs;
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
