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

  if (!textarea || !analyzeBtn || !statusEl || !resultEl || !scoreTitleEl || !scoreBadgeEl || !scoreProgressEl || !feedbackListEl) {
    return;
  }

  analyzeBtn.addEventListener("click", analyzeResumeHandler);

  async function analyzeResumeHandler() {
    const resumeText = String(textarea.value || "").trim();

    if (!resumeText) {
      showStatus("Please paste your resume first.", true);
      return;
    }

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

      renderResult(data.score, data.feedback, data.rating);
      showStatus("Analysis complete.", false, true);
    } catch (err) {
      showStatus(err.message || "Unable to analyze resume right now.", true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  function renderResult(score, feedback, rating) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const safeFeedback = Array.isArray(feedback) ? feedback : [];
    const safeRating = String(rating || "").trim();

    scoreTitleEl.textContent = safeRating
      ? `Resume Score: ${safeScore}% (${safeRating})`
      : `Resume Score: ${safeScore}%`;
    scoreProgressEl.style.width = `${safeScore}%`;
    scoreProgressEl.classList.remove("strong", "decent", "needs-work");
    scoreBadgeEl.classList.remove("strong", "decent", "needs-work");

    if (safeScore >= 80) {
      scoreProgressEl.classList.add("strong");
      scoreBadgeEl.classList.add("strong");
      scoreBadgeEl.textContent = "Strong";
    } else if (safeScore >= 60) {
      scoreProgressEl.classList.add("decent");
      scoreBadgeEl.classList.add("decent");
      scoreBadgeEl.textContent = "Average";
    } else {
      scoreProgressEl.classList.add("needs-work");
      scoreBadgeEl.classList.add("needs-work");
      scoreBadgeEl.textContent = "Needs Improvement";
    }

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
