(function () {
  const resumeInput = document.getElementById("resume-input");
  const analyzeBtn = document.getElementById("analyze-btn");
  const fixBtn = document.getElementById("fix-btn");
  const copyBtn = document.getElementById("copy-btn");

  const errorText = document.getElementById("error-text");
  const analysisSection = document.getElementById("analysis-section");
  const improvementsSection = document.getElementById("improvements-section");
  const paywallSection = document.getElementById("paywall-section");
  const optimizedSection = document.getElementById("optimized-section");

  const scorePill = document.getElementById("score-pill");
  const breakdownGrid = document.getElementById("breakdown-grid");
  const improvementsGrid = document.getElementById("improvements-grid");
  const optimizedOutput = document.getElementById("optimized-output");

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

  let isLoading = false;
  let isPaid = false;
  let fixedResume = "";

  function setError(message) {
    errorText.textContent = message || "";
  }

  function setLoading(loading, mode) {
    isLoading = loading;
    if (mode === "analyze") {
      analyzeBtn.textContent = loading ? "Analyzing..." : "Analyze Resume";
    }
    if (mode === "fix") {
      fixBtn.textContent = loading ? "Optimizing Resume..." : "Fix My Resume ->";
    }

    analyzeBtn.disabled = loading || isPaid;
    fixBtn.disabled = loading || !analysisSection || analysisSection.classList.contains("hidden") || isPaid;
  }

  function showAnalysisSections() {
    analysisSection.classList.remove("hidden");
    improvementsSection.classList.remove("hidden");
    paywallSection.classList.remove("hidden");
    optimizedSection.classList.add("hidden");
  }

  function showOptimizedSection() {
    analysisSection.classList.add("hidden");
    improvementsSection.classList.add("hidden");
    paywallSection.classList.add("hidden");
    optimizedSection.classList.remove("hidden");
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
    const resumeText = String(resumeInput.value || "").trim();
    if (!resumeText) {
      setError("Please paste your resume first.");
      return;
    }

    setError("");
    isPaid = false;
    fixedResume = "";
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
      showAnalysisSections();
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to analyze resume.");
    } finally {
      setLoading(false, "analyze");
    }
  }

  async function fixResume() {
    const resumeText = String(resumeInput.value || "").trim();
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

      fixedResume = String(data.fixedResume || "").trim();
      if (!fixedResume) {
        throw new Error("Resume optimization failed.");
      }

      isPaid = true;
      optimizedOutput.textContent = fixedResume;
      showOptimizedSection();
    } catch (error) {
      setError(error && error.message ? error.message : "Unable to optimize resume.");
    } finally {
      setLoading(false, "fix");
    }
  }

  async function copyResume() {
    if (!fixedResume) return;
    try {
      await navigator.clipboard.writeText(fixedResume);
      copyBtn.textContent = "Copied!";
      setTimeout(function () {
        copyBtn.textContent = "Copy";
      }, 1500);
    } catch (_err) {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  analyzeBtn.addEventListener("click", analyzeResume);
  fixBtn.addEventListener("click", fixResume);
  copyBtn.addEventListener("click", copyResume);
})();
