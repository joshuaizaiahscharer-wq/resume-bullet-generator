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
  const ctaSubtextEl = document.getElementById("ctaSubtext");
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

    const personalizedFeedback = buildPersonalizedInsights(resumeText, safeFeedback);

    // Render before/after improvement cards (show 2-3, blur the rest)
    renderImprovements(safeFeedback, resumeText);

    // Render detailed feedback
    feedbackListEl.innerHTML = "";
    const items = personalizedFeedback.length
      ? personalizedFeedback
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
    const maxVisible = 3; // Always show 2-3 improvements before paywall
    const improvements = generateImprovementPairs(feedback, resumeText);

    improvementsListEl.innerHTML = "";

    // Add visible improvement cards
    improvements.slice(0, maxVisible).forEach((improvement) => {
      const card = createImprovementCard(improvement);
      improvementsListEl.appendChild(card);
    });

    // Never show CTA before showing value.
    const visibleCount = Math.min(maxVisible, improvements.length);
    const shouldShowCta = visibleCount >= 2;
    ctaBtn.classList.toggle("hidden", !shouldShowCta);
    if (ctaSubtextEl) {
      ctaSubtextEl.classList.toggle("hidden", !shouldShowCta);
    }

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
        // If locked, show count in required format.
        moreImprovementsEl.textContent = `+ ${remaining} more ${remaining === 1 ? "improvement" : "improvements"} available`;
        improvementsBlurEl.classList.remove("hidden");
      }
    } else {
      improvementsBlurEl.classList.add("hidden");
    }
  }

  function generateImprovementPairs(feedback, resumeText) {
    const experienceData = extractExperienceData(resumeText);
    const roleType = detectPrimaryRoleType(experienceData.roles, resumeText);
    const experienceBullets = experienceData.bullets;
    const weakBullets = identifyWeakBullets(experienceBullets);
    const fallbackBullets = getFallbackBullets(experienceBullets, weakBullets);
    const candidates = [...weakBullets, ...fallbackBullets].slice(0, 6);

    // If the resume has job titles in Experience but no bullets, generate role-based samples.
    if (!experienceBullets.length && experienceData.roles.length) {
      return ensureMinimumImprovements(
        experienceData.roles.slice(0, 3).map((role) => buildRoleOnlyImprovement(role)),
        experienceData
      );
    }

    const rewrittenPairs = candidates
      .map((bullet) => {
        const improved = improveBullet(bullet, roleType);
        if (!improved) return null;
        return { before: bullet, after: improved };
      })
      .filter(Boolean);

    // If bullets exist but couldn't be rewritten confidently, still provide role-based value.
    if (!rewrittenPairs.length && experienceData.roles.length) {
      return ensureMinimumImprovements(
        experienceData.roles.slice(0, 3).map((role) => buildRoleOnlyImprovement(role)),
        experienceData
      );
    }

    return ensureMinimumImprovements(rewrittenPairs, experienceData);
  }

  function ensureMinimumImprovements(pairs, experienceData) {
    const output = Array.isArray(pairs) ? [...pairs] : [];
    const roles = Array.isArray(experienceData?.roles) ? experienceData.roles : [];

    if (output.length >= 3) {
      return output;
    }

    const roleQueue = roles.length ? [...roles] : ["Professional Role"];
    let idx = 0;
    while (output.length < 3) {
      const role = roleQueue[idx % roleQueue.length] || "Professional Role";
      output.push(buildRoleOnlyImprovement(role));
      idx += 1;
      if (idx > 6) break;
    }

    return output;
  }

  function extractExperienceBullets(resumeText) {
    return extractExperienceData(resumeText).bullets;
  }

  function extractExperienceData(resumeText) {
    if (!resumeText) {
      return { bullets: [], roles: [] };
    }

    const lines = String(resumeText)
      .split(/\r?\n/)
      .map((line) => line.trim());

    const bullets = [];
    const roles = [];
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
        roles.push(line);
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

    return {
      bullets: dedupeList(bullets),
      roles: dedupeList(roles)
    };
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
    if (/^[-•*–—]\s+/.test(text)) return false;
    if (countWords(text) > 12) return false;
    if (/\b(19|20)\d{2}\b/.test(text)) return true;
    if (/\b(manager|engineer|analyst|assistant|specialist|coordinator|associate|director|intern)\b/i.test(text)) return true;
    if (/\b(server|nurse|cashier|barista|receptionist|teacher|driver|cook|chef|technician|developer|accountant|consultant|supervisor)\b/i.test(text)) return true;
    return false;
  }

  function buildRoleOnlyImprovement(roleLine) {
    const role = normalizeRoleTitle(roleLine);
    const generatedBullets = generateSampleBulletsForRole(role);
    const after = generatedBullets
      .map((line) => `• ${highlightMetrics(line)}`)
      .join("<br>");

    return {
      before: `${role} (Job Title Only)`,
      after
    };
  }

  function normalizeRoleTitle(roleLine) {
    const clean = String(roleLine || "")
      .replace(/\(.*?\)/g, "")
      .replace(/\b(19|20)\d{2}\b(?:\s*[-–]\s*\b(19|20)?\d{2}|\s*[-–]\s*present)?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!clean) return "Professional Role";
    return clean;
  }

  function generateSampleBulletsForRole(role) {
    const roleType = getRoleType(role);

    if (roleType === "server_bartender") {
      return [
        "Served 60-100 guests per shift while maintaining order accuracy and a high-quality dining experience.",
        "Handled $1,500-$2,800 in food and beverage transactions per shift using POS and cash controls.",
        "Coordinated with kitchen and bar staff to keep average ticket times within 10-14 minutes during peak hours."
      ];
    }

    if (roleType === "nurse") {
      return [
        "Provided direct care for 20-40 patients per shift, prioritizing timely treatment and patient safety.",
        "Documented assessments, medication records, and care updates for 25+ patients per shift in the EMR.",
        "Collaborated with physicians, CNAs, and case managers during handoffs to support continuity of care."
      ];
    }

    if (/teacher|instructor|educator|professor/.test(title)) {
      return [
        "Designed lesson plans for 90+ students, increasing assessment performance by 17% across core subjects.",
        "Implemented classroom engagement strategies that improved attendance consistency by 12%.",
        "Tracked student progress data weekly to identify learning gaps and raise pass rates by 15%."
      ];
    }

    if (/sales|account executive|business development|retail/.test(String(role || "").toLowerCase())) {
      return [
        "Managed a pipeline of 30-50 qualified prospects each month through consultative outreach and follow-up.",
        "Closed $40K-$80K in monthly sales by aligning product recommendations with customer needs.",
        "Maintained relationships with key accounts valued at $100K+ annually through proactive service."
      ];
    }

    if (/software|developer|engineer|programmer|it|technician/.test(String(role || "").toLowerCase())) {
      return [
        "Built and shipped features used by 10K-50K users while maintaining stable application performance.",
        "Resolved production incidents and support tickets within defined SLA windows for critical systems.",
        "Automated recurring operational tasks, saving 8-15 team hours per week across deployments and reporting."
      ];
    }

    if (/customer service|support|call center|representative/.test(String(role || "").toLowerCase())) {
      return [
        "Resolved 50-80 customer inquiries daily across phone, chat, and email support channels.",
        "Troubleshot account and service issues while meeting response-time and first-contact resolution targets.",
        "Documented recurring problems and escalations to help product teams prioritize fixes."
      ];
    }

    if (roleType === "receptionist_clinic") {
      return [
        "Scheduled and confirmed 35-60 appointments per day while coordinating provider availability.",
        "Managed front-desk check-ins for 50-90 patients or visitors daily to keep intake flow organized.",
        "Maintained patient and administrative records with consistent data-entry accuracy and timely updates."
      ];
    }

    return [
      "Managed core responsibilities for the role while maintaining quality and service standards.",
      "Coordinated with team members to complete high-priority tasks and maintain daily operations.",
      "Handled recurring workflow and documentation duties with strong attention to accuracy and timeliness."
    ];
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

  function improveBullet(bullet, roleHint) {
    const clean = String(bullet || "").replace(/^[-•*–—]\s+/, "").trim();
    if (!clean || countWords(clean) < 6 || isSkippableLine(clean)) {
      return null;
    }

    const core = clean
      .replace(/^(responsible for|worked on|helped with|demonstrated|assisted with|assisted|participated in|was involved in)\s+/i, "")
      .replace(/\.$/, "")
      .trim();

    if (!core || countWords(core) < 3) {
      return null;
    }

    const objectPhrase = normalizeObjectPhrase(core);
    if (!objectPhrase) {
      return null;
    }

    const effectiveRoleType = roleHint || getRoleType(core);
    const rewritten = buildRoleAwareRewrite(objectPhrase, effectiveRoleType, core);
    if (!rewritten) {
      return null;
    }

    const startsWithStrongVerb = /^(Managed|Served|Handled|Processed|Coordinated|Documented|Administered|Supported|Led|Resolved|Maintained|Delivered|Organized|Oversaw|Completed)\b/.test(rewritten);
    if (!startsWithStrongVerb) {
      return null;
    }

    return highlightMetrics(rewritten);
  }

  function detectPrimaryRoleType(roles, resumeText) {
    if (Array.isArray(roles) && roles.length) {
      const detected = getRoleType(roles[0]);
      if (detected !== "general") return detected;
    }
    return getRoleType(resumeText);
  }

  function getRoleType(text) {
    const value = String(text || "").toLowerCase();
    if (/server|waiter|waitress|bartender|barista/.test(value)) return "server_bartender";
    if (/registered nurse|\bnurse\b|\brn\b|\blpn\b|\bcna\b/.test(value)) return "nurse";
    if (/receptionist|front desk|clinic|medical office|patient access/.test(value)) return "receptionist_clinic";
    return "general";
  }

  function buildRoleAwareRewrite(objectPhrase, roleType, seedText) {
    const phrase = objectPhrase.charAt(0).toLowerCase() + objectPhrase.slice(1);
    const templatesByRole = {
      server_bartender: [
        `Served ${phrase} for 60-100 guests per shift while keeping order accuracy and service quality consistent.`,
        `Handled ${phrase} during high-volume service windows, processing $1,500-$2,500 in transactions per shift.`,
        `Coordinated ${phrase} with kitchen and bar staff to maintain 10-14 minute ticket times.`
      ],
      nurse: [
        `Managed ${phrase} for 20-40 patients per shift while following clinical safety protocols.`,
        `Documented ${phrase} in the EMR for 25+ patients each shift to support accurate care decisions.`,
        `Collaborated on ${phrase} with physicians and nursing staff during handoffs to improve continuity of care.`
      ],
      receptionist_clinic: [
        `Coordinated ${phrase} while scheduling and confirming 35-60 appointments per day.`,
        `Managed ${phrase} at the front desk for 50-90 daily patient or visitor check-ins.`,
        `Maintained ${phrase} across records, referrals, and insurance entries with reliable data accuracy.`
      ],
      general: [
        `Managed ${phrase} as part of daily operations while maintaining service and quality standards.`,
        `Coordinated ${phrase} with team members to complete high-priority tasks on schedule.`,
        `Handled ${phrase} consistently, supporting accurate documentation and dependable output.`
      ]
    };

    const templates = templatesByRole[roleType] || templatesByRole.general;
    const index = getDeterministicIndex(seedText, templates.length);
    return templates[index] || null;
  }

  function getDeterministicIndex(seedText, modulo) {
    const text = String(seedText || "");
    if (!text || modulo <= 0) return 0;
    let sum = 0;
    for (let i = 0; i < text.length; i += 1) {
      sum += text.charCodeAt(i);
    }
    return sum % modulo;
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
    return escaped.replace(/(\$\d[\d,.]*|\d+%|\d+\+|\d+-\d+|\d+\s*(minutes|patients|customers|appointments|guests))/gi, "<span class='improvement-highlight'>$1</span>");
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

  function buildPersonalizedInsights(resumeText, apiFeedback) {
    const experienceData = extractExperienceData(resumeText);
    const insights = [];

    if (experienceData.roles.length > 0 && experienceData.bullets.length === 0) {
      insights.push("Your experience section is missing bullet points");
    }

    const metricsRegex = /(\d+%|\$\d|\d+\+|\d+\s+(patients|customers|clients|users|projects|tickets|hours|days|weeks|months|years))/i;
    if (!metricsRegex.test(String(resumeText || ""))) {
      insights.push("Your resume lacks measurable impact");
    }

    apiFeedback.forEach((item) => {
      if (!insights.includes(item)) {
        insights.push(item);
      }
    });

    return insights.slice(0, 4);
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
