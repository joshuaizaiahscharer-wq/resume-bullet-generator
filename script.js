// ─── Configuration ──────────────────────────────────────────────────────────
// The API key lives in .env on the server — nothing sensitive here.
const API_URL = "/api/generate";

// ─── Hero typing cycle ────────────────────────────────────────────────────────
(function initHeroTyping() {
  const el = document.getElementById("heroTyped");
  if (!el) return;
  const words = [
    "interview-winning bullet points",
    "ATS-ready proof points",
    "recruiter-grabbing results",
    "stronger career stories",
  ];
  let idx = 0;

  function cycle() {
    idx = (idx + 1) % words.length;
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => {
      el.textContent = words[idx];
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 300);
  }

  el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(cycle, 2800);
  }
})();

// ─── DOM references ──────────────────────────────────────────────────────────
const generateBtn    = document.getElementById("generateBtn");
const jobTitleInput  = document.getElementById("jobTitle");
const statusEl       = document.getElementById("status");
const resultsSection = document.getElementById("resultsSection");
const resultsHeading = document.getElementById("resultsHeading");
const bulletList     = document.getElementById("bulletList");
const copyBtn        = document.getElementById("copyBtn");
const regenerateBtn  = document.getElementById("regenerateBtn");
const chipsContainer = document.getElementById("chips");
const supportForm    = document.getElementById("supportForm");
const supportStatus  = document.getElementById("supportStatus");
const supportBtn     = document.getElementById("supportSubmitBtn");
const jobDescriptionInput = document.getElementById("jobDescriptionInput");
const tailorHint = document.getElementById("tailorHint");
const findLandingKeywordsBtn = document.getElementById("findLandingKeywordsBtn");
const landingKeywordStatus = document.getElementById("landingKeywordStatus");
const landingKeywordResults = document.getElementById("landingKeywordResults");
const landingKeywordSummary = document.getElementById("landingKeywordSummary");
const landingKeywordChips = document.getElementById("landingKeywordChips");

const ROLE_KEYWORDS = {
  "software engineer": ["python", "javascript", "api", "microservices", "git", "testing", "agile", "sql", "cloud", "debugging"],
  "data analyst": ["sql", "excel", "tableau", "power bi", "dashboards", "kpi", "data cleaning", "etl", "reporting", "stakeholders"],
  "product manager": ["roadmap", "prioritization", "user research", "kpi", "cross-functional", "backlog", "launch", "strategy", "a/b testing", "analytics"],
  "project manager": ["scope", "timeline", "budget", "risk management", "stakeholder management", "agile", "scrum", "project planning", "delivery", "status reporting"],
  "marketing manager": ["seo", "sem", "campaign", "conversion", "content strategy", "email marketing", "google analytics", "lead generation", "brand", "roi"],
  "sales associate": ["customer engagement", "upselling", "cross-selling", "crm", "quota", "pipeline", "closing", "relationship building", "product knowledge", "follow-up"],
  bartender: ["customer service", "mixology", "cash handling", "inventory", "pos", "compliance", "upselling", "teamwork", "high-volume", "sanitation"],
  cashier: ["pos", "cash handling", "accuracy", "customer service", "returns", "transaction", "queue management", "reconciliation", "attention to detail", "loss prevention"],
  nurse: ["patient care", "charting", "emr", "vital signs", "medication administration", "care coordination", "triage", "infection control", "documentation", "communication"],
  teacher: ["curriculum", "classroom management", "lesson planning", "assessment", "student engagement", "differentiation", "parent communication", "data-driven instruction", "collaboration", "learning outcomes"],
};

const GENERIC_ROLE_KEYWORDS = ["results", "improved", "increased", "reduced", "collaborated", "led", "managed", "delivered", "optimized", "measurable"];

let currentBullets = [];

// ─── Load resume data from checker ───────────────────────────────────────────
(function loadResumeFromChecker() {
  const resumeData = sessionStorage.getItem("resumeDataFromChecker");
  if (resumeData && jobDescriptionInput) {
    jobDescriptionInput.value = resumeData;
    sessionStorage.removeItem("resumeDataFromChecker");
    // Scroll to input area
    jobDescriptionInput.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();

// ─── Event listeners ─────────────────────────────────────────────────────────
if (generateBtn) {
  generateBtn.addEventListener("click", handleGenerate);
}

if (regenerateBtn) {
  regenerateBtn.addEventListener("click", handleGenerate);
}

if (jobTitleInput) {
  jobTitleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGenerate();
  });

  // Clear active chip when user types manually
  jobTitleInput.addEventListener("input", () => {
    setActiveChip(null);
  });
}

if (copyBtn) {
  copyBtn.addEventListener("click", handleCopy);
}

if (supportForm) {
  supportForm.addEventListener("submit", handleSupportSubmit);
}

if (jobDescriptionInput) {
  jobDescriptionInput.addEventListener("input", () => {
    if (!tailorHint) return;
    tailorHint.classList.add("hidden");
    tailorHint.textContent = "";
    tailorHint.classList.remove("success", "error");

    if (jobTitleInput && jobTitleInput.value.trim()) {
      renderLandingKeywords(jobTitleInput.value.trim());
    }
  });
}

if (findLandingKeywordsBtn) {
  findLandingKeywordsBtn.addEventListener("click", () => {
    const role = String(jobTitleInput?.value || "").trim();
    if (!role) {
      setLandingKeywordStatus("Enter a target role first to find keywords.", true);
      landingKeywordResults?.classList.add("hidden");
      return;
    }

    setLandingKeywordStatus(`Showing recruiter keywords for ${role}.`, false);
    renderLandingKeywords(role);
  });
}

// ─── Quick-pick chips ─────────────────────────────────────────────────────────
if (chipsContainer) {
  chipsContainer.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip || !jobTitleInput) return;
    jobTitleInput.value = chip.textContent.trim();
    setActiveChip(chip);
    handleGenerate();
  });
}

function setActiveChip(activeChip) {
  if (!chipsContainer) return;
  chipsContainer.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("active", c === activeChip);
  });
}

function normalizeKeywordText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRoleKeywords(roleText) {
  const normalizedRole = normalizeKeywordText(roleText);
  if (!normalizedRole) return [];

  const exact = ROLE_KEYWORDS[normalizedRole];
  if (exact) return exact.slice();

  const partial = Object.keys(ROLE_KEYWORDS).find((role) => {
    return normalizedRole.includes(role) || role.includes(normalizedRole);
  });

  if (partial) return ROLE_KEYWORDS[partial].slice();
  return GENERIC_ROLE_KEYWORDS.slice();
}

function setLandingKeywordStatus(message, isError) {
  if (!landingKeywordStatus) return;
  landingKeywordStatus.textContent = message;
  landingKeywordStatus.classList.toggle("error", Boolean(isError));
}

function renderLandingKeywords(roleText) {
  if (!landingKeywordResults || !landingKeywordSummary || !landingKeywordChips) return;

  const roleKeywords = getRoleKeywords(roleText);
  const sourceText = normalizeKeywordText(String(jobDescriptionInput?.value || ""));
  const present = [];
  const missing = [];

  roleKeywords.forEach((keyword) => {
    if (sourceText && sourceText.includes(normalizeKeywordText(keyword))) {
      present.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  landingKeywordChips.innerHTML = "";
  missing.concat(present).forEach((keyword) => {
    const chip = document.createElement("span");
    chip.className = "landing-keyword-chip-v0 " + (missing.includes(keyword) ? "missing" : "present");
    chip.textContent = keyword;
    landingKeywordChips.appendChild(chip);
  });

  landingKeywordSummary.textContent = sourceText
    ? `Matched ${present.length} of ${roleKeywords.length} role keywords. Add the red ones where they are accurate.`
    : "Role keyword set ready. Paste resume content above to compare keyword coverage.";

  landingKeywordResults.classList.remove("hidden");
}

// ─── Core logic ──────────────────────────────────────────────────────────────
async function handleGenerate() {
  if (!jobTitleInput) return;

  const jobTitle = jobTitleInput.value.trim();

  if (!jobTitle) {
    showError("Please enter a job title before generating bullet points.");
    jobTitleInput.focus();
    return;
  }

  setLoading(true);

  try {
    const jdText = String(jobDescriptionInput?.value || "").trim();
    const result = await fetchBullets(jobTitle, jdText);
    displayBullets(result.bullets, jobTitle);
    showTailorHint(jdText.length > 10);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function fetchBullets(jobTitle, jobDescription = "") {
  const pagePath = window.location.pathname;
  const userId = getCurrentUserId();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobTitle,
      jobDescription: String(jobDescription || "").trim(),
      // Send page metadata for backend usage tracking.
      pagePath,
      pageType: inferPageType(pagePath),
      userId,
    }),
  });

  const data = await response.json();
  console.log("Generate API response:", data);

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  if (!data.bullets || data.bullets.length === 0) {
    throw new Error("The server returned no bullet points. Please try again.");
  }

  return {
    bullets: data.bullets,
  };
}

function getCurrentUserId() {
  try {
    // Common places where apps expose authenticated user id.
    return (
      window.__USER__?.id ||
      window.__AUTH_USER_ID ||
      window.Clerk?.user?.id ||
      window.firebase?.auth?.()?.currentUser?.uid ||
      null
    );
  } catch (_err) {
    return null;
  }
}

function inferPageType(pathname) {
  if (!pathname || pathname === "/") return "generator";
  if (pathname === "/jobs") return "jobs";
  if (pathname.endsWith("-resume-summary-examples")) return "summary";
  if (pathname.endsWith("-skills-for-resume")) return "skills";
  if (pathname.endsWith("-cover-letter-examples")) return "cover-letter";
  if (pathname.endsWith("-resume-bullets-no-experience")) return "no-experience";
  if (pathname.startsWith("/resume-bullet-points-for-")) return "job-generator";
  return "unknown";
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function displayBullets(bullets, jobTitle) {
  clearStatus();
  currentBullets = bullets.slice();

  // Update heading with count and title
  const count = bullets.length;
  resultsHeading.textContent = `${count} Bullet Point${count !== 1 ? "s" : ""} — ${jobTitle}`;

  renderBulletList(bullets);

  resultsSection.classList.remove("hidden");

  // Reset copy button label
  copyBtn.textContent = "Copy All";
  copyBtn.classList.remove("copied");

  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderBulletList(bullets) {
  bulletList.innerHTML = "";

  bullets.forEach((text) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "bullet-text";

    span.textContent = text;
    li.appendChild(span);

    const btn = document.createElement("button");
    btn.className = "bullet-copy";
    btn.innerHTML = '<span class="bullet-copy-icon">[]</span><span class="bullet-copy-label">Copy</span>';
    btn.setAttribute("aria-label", "Copy this bullet point");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copySingleBullet(btn, text);
    });
    li.appendChild(btn);

    bulletList.appendChild(li);
  });
}

function showTailorHint(hasJobDescription) {
  if (!tailorHint) return;
  tailorHint.classList.remove("hidden", "error", "success");
  if (hasJobDescription) {
    tailorHint.textContent = "✔ Tailored to your job description";
    tailorHint.classList.add("success");
    return;
  }

  tailorHint.textContent = "Using general industry best practices";
}

function copySingleBullet(btn, text) {
  const setButtonLabel = (labelText) => {
    btn.innerHTML = `<span class="bullet-copy-icon">[]</span><span class="bullet-copy-label">${labelText}</span>`;
  };

  const write = () => {
    setButtonLabel("Copied!");
    btn.classList.add("copied");
    setTimeout(() => {
      setButtonLabel("Copy");
      btn.classList.remove("copied");
    }, 1800);
  };

  navigator.clipboard.writeText(`• ${text}`).then(write).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = `• ${text}`;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    write();
  });
}

function setLoading(isLoading) {
  if (generateBtn) generateBtn.disabled = isLoading;
  if (regenerateBtn) regenerateBtn.disabled = isLoading;
  if (copyBtn) copyBtn.disabled = isLoading;

  if (isLoading) {
    if (resultsSection) resultsSection.classList.add("hidden");
    if (statusEl) {
      statusEl.innerHTML =
        '<span class="spinner"></span> Generating bullet points…';
      statusEl.classList.remove("hidden", "error");
    }
  } else {
    clearStatus();
  }
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
  statusEl.classList.add("error");
  resultsSection.classList.add("hidden");
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.classList.add("hidden");
  statusEl.classList.remove("error");
}

async function handleSupportSubmit(event) {
  event.preventDefault();

  if (!supportForm || !supportStatus || !supportBtn) return;

  const formData = new FormData(supportForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!email) {
    showSupportStatus("Please enter your email address.", true);
    return;
  }

  if (message.length < 10) {
    showSupportStatus("Please include a short message so we can help.", true);
    return;
  }

  supportBtn.disabled = true;
  showSupportStatus("Sending your message...", false);

  try {
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        message,
        pagePath: window.location.pathname,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Unable to submit your message right now.");
    }

    supportForm.reset();
    showSupportStatus("Message sent. Our team will follow up soon.", false);
  } catch (err) {
    showSupportStatus(err.message || "Unable to submit your message right now.", true);
  } finally {
    supportBtn.disabled = false;
  }
}

function showSupportStatus(message, isError) {
  if (!supportStatus) return;
  supportStatus.textContent = message;
  supportStatus.classList.remove("hidden", "error", "success");
  supportStatus.classList.add(isError ? "error" : "success");
}

async function handleCopy() {
  const items = [...bulletList.querySelectorAll("li span")];
  if (items.length === 0) return;

  const text = items.map((s) => `• ${s.textContent}`).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy All";
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch (_) {
    // Fallback for browsers that block clipboard API
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity  = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy All";
      copyBtn.classList.remove("copied");
    }, 2000);
  }
}
