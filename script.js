// ─── Configuration ──────────────────────────────────────────────────────────
// The API key lives in .env on the server — nothing sensitive here.
const API_URL = "/api/generate";

// ─── DOM references ──────────────────────────────────────────────────────────
const generateBtn    = document.getElementById("generateBtn");
const jobTitleInput  = document.getElementById("jobTitle");
const statusEl       = document.getElementById("status");
const resultsSection = document.getElementById("resultsSection");
const bulletList     = document.getElementById("bulletList");
const copyBtn        = document.getElementById("copyBtn");

// ─── Event listeners ─────────────────────────────────────────────────────────
generateBtn.addEventListener("click", handleGenerate);

jobTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleGenerate();
});

copyBtn.addEventListener("click", handleCopy);

// ─── Core logic ──────────────────────────────────────────────────────────────
async function handleGenerate() {
  const jobTitle = jobTitleInput.value.trim();

  if (!jobTitle) {
    showError("Please enter a job title before generating bullet points.");
    jobTitleInput.focus();
    return;
  }

  setLoading(true);

  try {
    const bullets = await fetchBullets(jobTitle);
    displayBullets(bullets);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function fetchBullets(jobTitle) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobTitle }),
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

// ─── UI helpers ──────────────────────────────────────────────────────────────
function displayBullets(bullets) {
  clearStatus();

  // Clear previous results
  bulletList.innerHTML = "";

  bullets.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    bulletList.appendChild(li);
  });

  resultsSection.classList.remove("hidden");

  // Reset copy button label
  copyBtn.textContent = "Copy All";
  copyBtn.classList.remove("copied");

  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  copyBtn.disabled     = isLoading;

  if (isLoading) {
    resultsSection.classList.add("hidden");
    statusEl.innerHTML =
      '<span class="spinner"></span> Generating bullet points…';
    statusEl.classList.remove("hidden", "error");
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

async function handleCopy() {
  const items = [...bulletList.querySelectorAll("li")];
  if (items.length === 0) return;

  const text = items.map((li) => `• ${li.textContent}`).join("\n");

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
