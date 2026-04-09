// ─── Configuration ──────────────────────────────────────────────────────────
// The API key lives in .env on the server — nothing sensitive here.
const API_URL = "/api/generate";

// ─── Hero typing cycle ────────────────────────────────────────────────────────
(function initHeroTyping() {
  const el = document.getElementById("heroTyped");
  if (!el) return;
  const words = ["interviews.", "callbacks.", "offers.", "results."];
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
    const bullets = await fetchBullets(jobTitle);
    displayBullets(bullets, jobTitle);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function fetchBullets(jobTitle) {
  const pagePath = window.location.pathname;
  const userId = getCurrentUserId();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobTitle,
      // Send page metadata for backend usage tracking.
      pagePath,
      pageType: inferPageType(pagePath),
      userId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  if (!data.bullets || data.bullets.length === 0) {
    throw new Error("The server returned no bullet points. Please try again.");
  }

  return data.bullets;
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

  // Update heading with count and title
  const count = bullets.length;
  resultsHeading.textContent = `${count} Bullet Point${count !== 1 ? "s" : ""} — ${jobTitle}`;

  // Clear previous results
  bulletList.innerHTML = "";

  bullets.forEach((text) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "bullet-text";
    span.textContent = text;
    li.appendChild(span);

    const btn = document.createElement("button");
    btn.className = "bullet-copy";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy this bullet point");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copySingleBullet(btn, text);
    });
    li.appendChild(btn);

    bulletList.appendChild(li);
  });

  resultsSection.classList.remove("hidden");

  // Reset copy button label
  copyBtn.textContent = "Copy All";
  copyBtn.classList.remove("copied");

  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function copySingleBullet(btn, text) {
  const write = () => {
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy";
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
