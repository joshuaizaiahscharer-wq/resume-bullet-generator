(function () {
  const resumeInput = document.getElementById("resume-input");
  const resumeFileInput = document.getElementById("resume-file");
  const analyzeBtn = document.getElementById("analyze-btn");
  const fixBtn = document.getElementById("fix-btn");
  const finalizeBtn = document.getElementById("finalize-btn");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const paywallModal = document.getElementById("paywall-modal");
  const paywallUnlockBtn = document.getElementById("paywall-unlock-btn");
  const paywallCancelBtn = document.getElementById("paywall-cancel-btn");
  const targetRoleInput = document.getElementById("target-role-input");
  const findKeywordsBtn = document.getElementById("find-keywords-btn");
  const keywordStatus = document.getElementById("keyword-status");
  const keywordResults = document.getElementById("keyword-results");
  const keywordMatchSummary = document.getElementById("keyword-match-summary");
  const keywordChips = document.getElementById("keyword-chips");

  const errorText = document.getElementById("error-text");
  const analysisSection = document.getElementById("analysis-section");
  const improvementsSection = document.getElementById("improvements-section");
  const paywallSection = document.getElementById("paywall-section");
  const previewSection = document.getElementById("preview-section");
  const optimizedSection = document.getElementById("optimized-section");

  const scorePill = document.getElementById("score-pill");
  const breakdownGrid = document.getElementById("breakdown-grid");
  const improvementsGrid = document.getElementById("improvements-grid");
  const changePreviewList = document.getElementById("change-preview-list");
  const optimizedOutput = document.getElementById("optimized-output");
  const optimizedStatus = document.getElementById("optimized-status");
  const paywallHint = document.getElementById("paywall-hint");
  const pdfDisclaimer = document.getElementById("pdf-disclaimer");

  const categories = [
    { key: "structure", label: "Structure" },
    { key: "flow", label: "Flow & Readability" },
    { key: "organization", label: "Organization" },
    { key: "grammar", label: "Grammar & Spelling" },
    { key: "bulletUsage", label: "Bullet Point Usage" },
    { key: "bulletStrength", label: "Bullet Point Strength" },
    { key: "impact", label: "Impact" },
    { key: "relevance", label: "Relevance" },
  ];

  const roleKeywordMap = {
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

  const genericKeywords = ["results", "improved", "increased", "reduced", "collaborated", "led", "managed", "delivered", "optimized", "measurable"];

  let isLoading = false;
  let isPaid = false;
  let showPaywall = false;
  let fixedResume = "";
  let originalResumeText = "";
  let improvedResumeText = "";
  let finalResumeText = "";
  let resumeChanges = [];
  let acceptedChanges = [];
  let rejectedChanges = [];
  let extractedResumeText = "";
  let inputFileType = "";
  let optimizedSections = null;

  function saveCheckoutDraft() {
    const payload = {
      finalResumeText,
      optimizedSections,
      inputFileType,
    };
    localStorage.setItem("resumeCheckoutDraft", JSON.stringify(payload));
  }

  function restoreCheckoutDraft() {
    const raw = localStorage.getItem("resumeCheckoutDraft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      finalResumeText = String(draft?.finalResumeText || "").trim();
      fixedResume = finalResumeText;
      optimizedSections = draft?.optimizedSections || null;
      inputFileType = String(draft?.inputFileType || inputFileType || "").toLowerCase();
      if (finalResumeText) {
        optimizedOutput.textContent = finalResumeText;
        showOptimizedSection();
      }
    } catch (_error) {
      // ignore malformed localStorage
    }
  }

  function getDownloadFileNameFromHeader(contentDisposition, fallbackName) {
    const value = String(contentDisposition || "");
    const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch && utfMatch[1]) {
      return decodeURIComponent(utfMatch[1]);
    }
    const basicMatch = value.match(/filename="?([^";]+)"?/i);
    if (basicMatch && basicMatch[1]) {
      return basicMatch[1];
    }
    return fallbackName;
  }

  function setError(message) {
    errorText.textContent = message || "";
  }

  function setKeywordStatus(message, isError) {
    if (!keywordStatus) return;
    keywordStatus.textContent = message || "";
    keywordStatus.classList.toggle("error", Boolean(isError));
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s\-\/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getRoleKeywords(roleText) {
    const normalizedRole = normalizeText(roleText);
    if (!normalizedRole) return [];

    const exact = roleKeywordMap[normalizedRole];
    if (exact) return exact.slice();

    const partialMatch = Object.keys(roleKeywordMap).find(function (role) {
      return normalizedRole.includes(role) || role.includes(normalizedRole);
    });

    if (partialMatch) {
      return roleKeywordMap[partialMatch].slice();
    }

    return genericKeywords.slice();
  }

  function renderKeywordResults(roleText) {
    if (!keywordResults || !keywordMatchSummary || !keywordChips) return;

    const roleKeywords = getRoleKeywords(roleText);
    const resumeText = normalizeText(resumeInput ? resumeInput.value : "");
    const presentKeywords = [];
    const missingKeywords = [];

    roleKeywords.forEach(function (keyword) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return;
      if (resumeText && resumeText.includes(normalizedKeyword)) {
        presentKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    keywordChips.innerHTML = "";

    missingKeywords.concat(presentKeywords).forEach(function (keyword) {
      const chip = document.createElement("span");
      chip.className = "keyword-chip " + (missingKeywords.indexOf(keyword) !== -1 ? "missing" : "present");
      chip.textContent = keyword;
      keywordChips.appendChild(chip);
    });

    if (resumeText) {
      keywordMatchSummary.textContent =
        "Matched " +
        presentKeywords.length +
        " of " +
        roleKeywords.length +
        " role keywords. Add the red keywords where they are truthful to improve recruiter matching.";
    } else {
      keywordMatchSummary.textContent = "Keyword set ready. Paste your resume text to see which keywords are already covered.";
    }

    keywordResults.classList.remove("hidden");
  }

  function handleKeywordSearch() {
    if (!targetRoleInput) return;

    const roleText = String(targetRoleInput.value || "").trim();
    if (!roleText) {
      setKeywordStatus("Enter a target role to search recruiter keywords.", true);
      if (keywordResults) keywordResults.classList.add("hidden");
      return;
    }

    setKeywordStatus("Showing role-specific keywords for " + roleText + ".", false);
    renderKeywordResults(roleText);
  }

  function setLoading(loading, mode) {
    isLoading = loading;
    if (mode === "analyze") {
      analyzeBtn.textContent = loading ? "Analyzing..." : "Analyze Resume";
    }
    if (mode === "fix") {
      fixBtn.textContent = loading ? "Optimizing Resume..." : "Fix My Resume ->";
    }

    analyzeBtn.disabled = loading;
    fixBtn.disabled = loading || !analysisSection || analysisSection.classList.contains("hidden");
  }

  function setPaywallVisible(visible) {
    showPaywall = visible;
    if (paywallModal) {
      paywallModal.classList.toggle("hidden", !visible);
    }
    if (!visible && paywallUnlockBtn) {
      paywallUnlockBtn.disabled = false;
      paywallUnlockBtn.textContent = "Unlock & Download";
    }
  }

  function showAnalysisSections() {
    analysisSection.classList.remove("hidden");
    improvementsSection.classList.remove("hidden");
    paywallSection.classList.remove("hidden");
    previewSection.classList.add("hidden");
    optimizedSection.classList.add("hidden");
  }

  function showPreviewSection() {
    previewSection.classList.remove("hidden");
    optimizedSection.classList.add("hidden");
  }

  function showOptimizedSection() {
    analysisSection.classList.add("hidden");
    improvementsSection.classList.add("hidden");
    paywallSection.classList.add("hidden");
    previewSection.classList.add("hidden");
    optimizedSection.classList.remove("hidden");
  }

  function renderResumeChangePreview() {
    changePreviewList.innerHTML = "";

    if (!Array.isArray(resumeChanges) || resumeChanges.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "preview-subtext";
      emptyState.textContent = "No line-by-line changes were extracted. You can still build your final resume.";
      changePreviewList.appendChild(emptyState);
      return;
    }

    resumeChanges.forEach(function (change, index) {
      const card = document.createElement("article");
      card.className = "change-card";

      const title = document.createElement("p");
      title.innerHTML = "<strong>Change " + (index + 1) + "</strong>";

      const original = document.createElement("div");
      original.className = "change-original";
      original.textContent = "Original: " + String(change.original || "");

      const improved = document.createElement("div");
      improved.className = "change-improved";
      improved.textContent = "Improved: " + String(change.improved || "");

      const reason = document.createElement("p");
      reason.className = "change-reason";
      reason.textContent = "Reason: " + String(change.reason || "Improved for clarity and competitiveness.");

      const actions = document.createElement("div");
      actions.className = "change-actions";

      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "choice-btn";
      acceptBtn.textContent = "Accept Change";

      const rejectBtn = document.createElement("button");
      rejectBtn.type = "button";
      rejectBtn.className = "choice-btn";
      rejectBtn.textContent = "Keep Original";

      const isAccepted = acceptedChanges.indexOf(index) !== -1;
      const isRejected = rejectedChanges.indexOf(index) !== -1;
      if (isAccepted) acceptBtn.classList.add("active", "accept");
      if (isRejected) rejectBtn.classList.add("active", "reject");

      acceptBtn.addEventListener("click", function () {
        if (acceptedChanges.indexOf(index) === -1) acceptedChanges.push(index);
        rejectedChanges = rejectedChanges.filter(function (item) {
          return item !== index;
        });
        renderResumeChangePreview();
      });

      rejectBtn.addEventListener("click", function () {
        if (rejectedChanges.indexOf(index) === -1) rejectedChanges.push(index);
        acceptedChanges = acceptedChanges.filter(function (item) {
          return item !== index;
        });
        renderResumeChangePreview();
      });

      actions.appendChild(acceptBtn);
      actions.appendChild(rejectBtn);

      card.appendChild(title);
      card.appendChild(original);
      card.appendChild(improved);
      card.appendChild(reason);
      card.appendChild(actions);
      changePreviewList.appendChild(card);
    });
  }

  function buildFinalResumeFromDecisions() {
    let output = String(improvedResumeText || "");

    rejectedChanges.forEach(function (index) {
      const change = resumeChanges[index];
      if (!change || !change.improved || !change.original) return;
      output = output.replace(change.improved, change.original);
    });

    return output.trim();
  }

  async function extractTextFromSelectedFile() {
    const file = resumeFileInput.files && resumeFileInput.files[0];
    if (!file) return null;

    const formData = new FormData();
    formData.append("resumeFile", file);

    const response = await fetch("/api/extract-resume-text", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || "Failed to extract text from uploaded file.");
    }

    extractedResumeText = String(data.extractedText || "").trim();
    inputFileType = String(data.fileType || "").toLowerCase();
    if (extractedResumeText) {
      resumeInput.value = extractedResumeText;
    }
    return extractedResumeText;
  }

  function renderBreakdown(breakdown) {
    breakdownGrid.innerHTML = "";

    categories.forEach(({ key, label }) => {
      const value = Math.max(0, Math.min(100, Number(breakdown[key]) || 0));
      const card = document.createElement("div");
      card.className = "breakdown-card";
      card.innerHTML =
        '<div class="breakdown-top"><span>' +
        label +
        "</span><span>" +
        value +
        '%</span></div><div class="progress-track"><div class="progress-fill" style="width:' +
        value +
        '%"></div></div>';
      breakdownGrid.appendChild(card);
    });
  }

  function renderImprovements(improvements) {
    improvementsGrid.innerHTML = "";
    (improvements || []).slice(0, 3).forEach((text, index) => {
      const card = document.createElement("div");
      card.className = "improvement-card";
      card.innerHTML =
        "<strong>Improvement " +
        (index + 1) +
        "</strong><p>" +
        String(text || "") +
        "</p>";
      improvementsGrid.appendChild(card);
    });
  }

  async function analyzeResume() {
    let resumeText = String(resumeInput.value || "").trim();

    const hasFile = resumeFileInput.files && resumeFileInput.files[0];
    if (hasFile) {
      resumeText = (await extractTextFromSelectedFile()) || "";
    }

    if (!resumeText) {
      setError("Please paste your resume first.");
      return;
    }

    setError("");
    isPaid = false;
    setPaywallVisible(false);
    fixedResume = "";
    originalResumeText = "";
    improvedResumeText = "";
    finalResumeText = "";
    resumeChanges = [];
    acceptedChanges = [];
    rejectedChanges = [];
    setLoading(true, "analyze");

    try {
      const response = await fetch("/api/check-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      scorePill.textContent = String(data.score || 0) + "% (" + String(data.label || "Weak") + ")";
      renderBreakdown(data.breakdown || {});
      renderImprovements(data.improvements || []);

      if (targetRoleInput && targetRoleInput.value.trim()) {
        renderKeywordResults(targetRoleInput.value.trim());
      }
      showAnalysisSections();
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to analyze resume.");
    } finally {
      setLoading(false, "analyze");
    }
  }

  if (findKeywordsBtn) {
    findKeywordsBtn.addEventListener("click", handleKeywordSearch);
  }

  if (targetRoleInput) {
    targetRoleInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleKeywordSearch();
      }
    });
  }

  async function fixResume() {
    let resumeText = String(resumeInput.value || "").trim();

    const hasFile = resumeFileInput.files && resumeFileInput.files[0];
    if (hasFile && !extractedResumeText) {
      resumeText = (await extractTextFromSelectedFile()) || "";
    }

    if (!resumeText && extractedResumeText) {
      resumeText = extractedResumeText;
    }

    if (!resumeText) {
      setError("Please paste your resume first.");
      return;
    }

    setError("");
    setLoading(true, "fix");

    try {
      const response = await fetch("/api/fix-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(data.error || "Resume optimization failed.");
      }

      originalResumeText = String(data.original || resumeText || "").trim();
      improvedResumeText = String(data.improved || data.fixedResume || "").trim();
      resumeChanges = Array.isArray(data.changes)
        ? data.changes.filter(function (change) {
            return change && change.original && change.improved;
          })
        : [];

      acceptedChanges = resumeChanges.map(function (_item, index) {
        return index;
      });
      rejectedChanges = [];

      fixedResume = improvedResumeText;
      optimizedSections = data.sections || null;
      if (!improvedResumeText) {
        throw new Error("Resume optimization failed.");
      }

      renderResumeChangePreview();
      showPreviewSection();
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to optimize resume.");
    } finally {
      setLoading(false, "fix");
    }
  }

  async function copyResume() {
    if (!finalResumeText) return;
    try {
      await navigator.clipboard.writeText(finalResumeText);
      copyBtn.textContent = "Copied!";
      setTimeout(function () {
        copyBtn.textContent = "Copy";
      }, 1500);
    } catch (_err) {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  async function downloadResume() {
    if (!finalResumeText) {
      setError("No final resume is available to download yet.");
      return;
    }

    if (!isPaid) {
      setPaywallVisible(true);
      return;
    }

    return performDownload();
  }

  async function handleStripeCheckout() {
    try {
      paywallUnlockBtn.disabled = true;
      paywallUnlockBtn.textContent = "Redirecting...";
      saveCheckoutDraft();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to start checkout.");
      paywallUnlockBtn.disabled = false;
      paywallUnlockBtn.textContent = "Unlock & Download";
    }
  }

  async function performDownload() {
    if (!finalResumeText) return;

    try {
      const outputFormat = inputFileType === "pdf" ? "pdf" : "docx";
      const response = await fetch("/api/download-optimized-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalResumeText: finalResumeText,
          sections: optimizedSections,
          outputFormat,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(function () {
          return {};
        });
        throw new Error(data.error || "Download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = outputFormat === "pdf" ? "Optimized_Resume.pdf" : "Optimized_Resume.docx";
      const filename = getDownloadFileNameFromHeader(
        response.headers.get("content-disposition"),
        fallbackName
      );
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      localStorage.removeItem("resumeCheckoutDraft");
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to download optimized resume.");
    }
  }

  finalizeBtn.addEventListener("click", function () {
    finalResumeText = buildFinalResumeFromDecisions();
    if (!finalResumeText) {
      finalResumeText = improvedResumeText || originalResumeText;
    }

    fixedResume = finalResumeText;
    optimizedOutput.textContent = finalResumeText;
    optimizedStatus.textContent = "Your Final Resume";
    if (paywallHint) {
      paywallHint.classList.remove("hidden");
    }
    showOptimizedSection();
  });

  paywallUnlockBtn.addEventListener("click", async function () {
    await handleStripeCheckout();
  });

  paywallCancelBtn.addEventListener("click", function () {
    setPaywallVisible(false);
  });

  resumeFileInput.addEventListener("change", function () {
    const selectedFile = resumeFileInput.files && resumeFileInput.files[0];
    const isPdf = Boolean(
      selectedFile &&
        (selectedFile.type === "application/pdf" ||
          String(selectedFile.name || "").toLowerCase().endsWith(".pdf"))
    );

    if (pdfDisclaimer) {
      pdfDisclaimer.classList.toggle("hidden", !isPdf);
    }

    extractedResumeText = "";
    inputFileType = "";
    optimizedSections = null;
    setError("");
  });

  analyzeBtn.addEventListener("click", analyzeResume);
  fixBtn.addEventListener("click", fixResume);
  copyBtn.addEventListener("click", copyResume);
  downloadBtn.addEventListener("click", downloadResume);

  const searchParams = new URLSearchParams(window.location.search);
  const paidInUrl = searchParams.get("paid") === "true";
  const paidInStorage = localStorage.getItem("resumePaid") === "true";

  if (paidInUrl) {
    isPaid = true;
    localStorage.setItem("resumePaid", "true");
    restoreCheckoutDraft();
    optimizedStatus.textContent = "Payment successful - your download is starting...";
    if (paywallHint) paywallHint.classList.add("hidden");

    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, "", cleanUrl);

    setTimeout(function () {
      performDownload();
    }, 200);
  } else if (paidInStorage) {
    isPaid = true;
    restoreCheckoutDraft();
    if (paywallHint) paywallHint.classList.add("hidden");
  }
})();
