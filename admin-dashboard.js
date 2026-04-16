import { UsersTable } from "/admin/ui-components.js";
import {
  fetchUsers,
  generateBlogPostDraft,
  getCurrentAuthUser,
  getOrCreateUserData,
  maybeTrackPaymentFromUrl,
  publishBlogPost,
  runAutomatedBlogGeneration,
  runSeoBlogBatchGeneration,
  subscribeToUsers,
  syncCurrentUserPresence,
  updateUserPayment,
} from "/admin/users-data.js";

console.log("Admin dashboard loaded");

const dashboardState = {
  users: [],
  query: "",
  filter: "all",
  sort: "lastActive_desc",
  isAdmin: null,
  pendingUserIds: new Set(),
  currentUserId: null,
  blogDraft: null,
  blogLoading: false,
  blogAutomationLoading: false,
  blogSeoBatchLoading: false,
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDraftContent(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let html = "";
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${escapeHtml(line)}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
}

function setBlogGeneratorStatus(message, tone = "neutral") {
  const status = document.getElementById("blogGeneratorStatus");
  if (!status) return;
  status.textContent = message || "";
  status.style.color = tone === "error" ? "#b91c1c" : tone === "success" ? "#166534" : "#475569";
}

function syncBlogGeneratorUiState() {
  const generateBtn = document.getElementById("generateBlogBtn");
  const publishBtn = document.getElementById("publishBlogBtn");
  const runAutoBtn = document.getElementById("runAutoBlogBtn");
  const runSeoBatchBtn = document.getElementById("runSeoBatchBtn");

  if (generateBtn) {
    generateBtn.disabled = dashboardState.blogLoading;
    generateBtn.textContent = dashboardState.blogLoading ? "Generating..." : "Generate Post";
  }

  if (publishBtn) {
    publishBtn.disabled =
      dashboardState.blogLoading || !dashboardState.blogDraft?.title || !dashboardState.blogDraft?.content;
  }

  if (runAutoBtn) {
    runAutoBtn.disabled = dashboardState.blogLoading || dashboardState.blogAutomationLoading;
    runAutoBtn.textContent = dashboardState.blogAutomationLoading ? "Running Automation..." : "Run Automation Now";
  }

  if (runSeoBatchBtn) {
    runSeoBatchBtn.disabled =
      dashboardState.blogLoading || dashboardState.blogAutomationLoading || dashboardState.blogSeoBatchLoading;
    runSeoBatchBtn.textContent = dashboardState.blogSeoBatchLoading
      ? "Generating SEO Batch..."
      : "Generate 10 SEO Posts";
  }
}

function renderBlogPreview(draft) {
  const shell = document.getElementById("blogPreviewShell");
  const title = document.getElementById("blogPreviewTitle");
  const content = document.getElementById("blogPreviewContent");
  const previewImage = document.getElementById("blogPreviewImage");
  const previewImageMeta = document.getElementById("blogPreviewImageMeta");
  if (!shell || !title || !content || !previewImage || !previewImageMeta) return;

  if (!draft?.title || !draft?.content) {
    shell.hidden = true;
    previewImage.hidden = true;
    previewImage.removeAttribute("src");
    previewImageMeta.hidden = true;
    previewImageMeta.textContent = "";
    syncBlogGeneratorUiState();
    return;
  }

  shell.hidden = false;
  title.textContent = draft.title;

  if (draft.image) {
    previewImage.src = draft.image;
    previewImage.hidden = false;
  } else {
    previewImage.hidden = true;
    previewImage.removeAttribute("src");
  }

  if (draft.imagePrompt) {
    const source = draft.imageSource ? ` (${draft.imageSource})` : "";
    previewImageMeta.textContent = `Image prompt: ${draft.imagePrompt}${source}`;
    previewImageMeta.hidden = false;
  } else {
    previewImageMeta.hidden = true;
    previewImageMeta.textContent = "";
  }

  content.innerHTML = renderDraftContent(draft.content);
  syncBlogGeneratorUiState();
}

async function handleGenerateBlogPost() {
  const topicInput = document.getElementById("blogTopicInput");
  const imagePromptInput = document.getElementById("blogImagePromptInput");
  const toneSelect = document.getElementById("blogToneSelect");
  const topic = String(topicInput?.value || "").trim();
  const imagePrompt = String(imagePromptInput?.value || "").trim();
  const tone = String(toneSelect?.value || "Professional");

  if (!topic) {
    setBlogGeneratorStatus("Enter a topic before generating.", "error");
    window.alert("Blog generation failed: Topic is required.");
    return;
  }

  dashboardState.blogLoading = true;
  dashboardState.blogDraft = null;
  renderBlogPreview(null);
  syncBlogGeneratorUiState();
  setBlogGeneratorStatus("Generating post draft...", "neutral");

  try {
    const draft = await generateBlogPostDraft(topic, tone, imagePrompt);
    dashboardState.blogDraft = draft;
    renderBlogPreview(draft);
    setBlogGeneratorStatus("Draft generated. Review and publish when ready.", "success");
  } catch (error) {
    const message = String(error?.message || "Failed to generate post.");
    console.error("GENERATION FAILED:", error);
    dashboardState.blogDraft = null;
    renderBlogPreview(null);
    setBlogGeneratorStatus(message, "error");
    window.alert("Blog generation failed: " + message);
  } finally {
    dashboardState.blogLoading = false;
    syncBlogGeneratorUiState();
  }
}

async function handlePublishBlogPost() {
  const publishBtn = document.getElementById("publishBlogBtn");
  const draft = dashboardState.blogDraft;

  if (!draft?.title || !draft?.content) {
    setBlogGeneratorStatus("Nothing to publish yet. Generate a draft first.", "error");
    return;
  }

  if (publishBtn) publishBtn.disabled = true;
  setBlogGeneratorStatus("Publishing post...", "neutral");

  try {
    const overrideDateRaw = document.getElementById("blogOverrideDateInput")?.value?.trim() || null;
    const customCreatedAt = overrideDateRaw ? new Date(overrideDateRaw).toISOString() : null;

    const saved = await publishBlogPost({
      title: draft.title,
      content: draft.content,
      image: draft.image || null,
      imagePrompt: draft.imagePrompt || null,
      customCreatedAt,
    });
    setBlogGeneratorStatus(`Published successfully: /blog/${saved.slug}`, "success");
    showToast("Blog post published", "success");
  } catch (error) {
    setBlogGeneratorStatus(String(error?.message || "Failed to publish post."), "error");
    showToast("Publish failed", "error");
  } finally {
    if (publishBtn) publishBtn.disabled = false;
  }
}

async function handleRunAutoBlogGeneration() {
  if (dashboardState.blogAutomationLoading) return;

  dashboardState.blogAutomationLoading = true;
  syncBlogGeneratorUiState();
  setBlogGeneratorStatus("Running automated blog generation...", "neutral");

  try {
    const result = await runAutomatedBlogGeneration();
    const title = result?.title ? `: ${result.title}` : "";
    const url = result?.url || (result?.slug ? `/blog/${result.slug}` : "");
    setBlogGeneratorStatus(
      `Automation completed${title}${url ? ` (${url})` : ""}`,
      "success"
    );
    showToast("Automation run completed", "success");
  } catch (error) {
    const message = String(error?.message || "Automation failed.");
    setBlogGeneratorStatus(message, "error");
    showToast("Automation failed", "error");
  } finally {
    dashboardState.blogAutomationLoading = false;
    syncBlogGeneratorUiState();
  }
}

async function handleRunSeoBatchGeneration() {
  if (dashboardState.blogSeoBatchLoading) return;

  dashboardState.blogSeoBatchLoading = true;
  syncBlogGeneratorUiState();
  setBlogGeneratorStatus("Generating 10 SEO posts. This may take a few minutes...", "neutral");

  try {
    const result = await runSeoBlogBatchGeneration();
    setBlogGeneratorStatus(
      `SEO batch finished: ${result.created || 0} created, ${result.skipped || 0} skipped, ${result.failed || 0} failed.`,
      result.failed ? "error" : "success"
    );
    showToast(result.failed ? "SEO batch completed with issues" : "SEO batch completed", result.failed ? "error" : "success");
  } catch (error) {
    const message = String(error?.message || "SEO batch failed.");
    setBlogGeneratorStatus(message, "error");
    showToast("SEO batch failed", "error");
  } finally {
    dashboardState.blogSeoBatchLoading = false;
    syncBlogGeneratorUiState();
  }
}

function renderLoadingState() {
  const gate = document.getElementById("adminAuthGate");
  const dashboard = document.getElementById("adminDashboardContent");
  if (gate) {
    gate.dataset.denied = "false";
    gate.hidden = false;
    const title = gate.querySelector(".admin-gate-title");
    const subtitle = gate.querySelector(".admin-gate-subtitle");
    const button = gate.querySelector("#adminGateSignInBtn");
    if (title) title.textContent = "Loading...";
    if (subtitle) subtitle.textContent = "Checking admin access.";
    if (button) button.hidden = true;
  }
  if (dashboard) dashboard.hidden = true;
}

function renderAuthGate(message) {
  const gate = document.getElementById("adminAuthGate");
  const dashboard = document.getElementById("adminDashboardContent");
  if (gate) {
    gate.dataset.denied = "false";
    gate.hidden = false;
    const title = gate.querySelector(".admin-gate-title");
    const subtitle = gate.querySelector(".admin-gate-subtitle");
    const button = gate.querySelector("#adminGateSignInBtn");
    if (title) title.textContent = "Sign in to access admin controls.";
    if (subtitle && message) subtitle.textContent = message;
    if (button) button.hidden = false;
  }
  if (dashboard) dashboard.hidden = true;
}

function renderAccessDenied(message) {
  const gate = document.getElementById("adminAuthGate");
  const dashboard = document.getElementById("adminDashboardContent");
  if (gate) {
    gate.dataset.denied = "true";
    gate.hidden = false;
    const title = gate.querySelector(".admin-gate-title");
    const subtitle = gate.querySelector(".admin-gate-subtitle");
    const button = gate.querySelector("#adminGateSignInBtn");
    if (title) title.textContent = "Access Denied";
    if (subtitle) subtitle.textContent = message || "You do not have permission to access this page.";
    if (button) button.hidden = true;
  }
  if (dashboard) dashboard.hidden = true;
}

function renderPostAuthDashboard() {
  const gate = document.getElementById("adminAuthGate");
  const dashboard = document.getElementById("adminDashboardContent");
  if (gate) {
    gate.dataset.denied = "false";
    gate.hidden = true;
  }
  if (dashboard) dashboard.hidden = false;
  console.log("ADMIN DASHBOARD LOADED");
}

function applyFilter(users) {
  if (dashboardState.filter === "paid") {
    return users.filter((user) => user.hasPaid);
  }

  if (dashboardState.filter === "free") {
    return users.filter((user) => !user.hasPaid);
  }

  return users;
}

function applySearch(users) {
  const q = dashboardState.query.trim().toLowerCase();
  if (!q) return users;

  return users.filter((user) => {
    return user.userId.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
  });
}

function applySort(users) {
  const sorted = [...users];

  if (dashboardState.sort === "payment_desc") {
    sorted.sort((a, b) => Number(b.hasPaid) - Number(a.hasPaid));
    return sorted;
  }

  if (dashboardState.sort === "payment_asc") {
    sorted.sort((a, b) => Number(a.hasPaid) - Number(b.hasPaid));
    return sorted;
  }

  if (dashboardState.sort === "lastActive_asc") {
    sorted.sort((a, b) => a.lastActive - b.lastActive);
    return sorted;
  }

  sorted.sort((a, b) => b.lastActive - a.lastActive);
  return sorted;
}

function renderDashboard() {
  const root = document.getElementById("adminTableRoot");
  if (!root) return;

  const filtered = applyFilter(dashboardState.users);
  const searched = applySearch(filtered);
  const sorted = applySort(searched);

  const usersWithUiState = sorted.map((user) => ({
    ...user,
    controlsDisabled: !dashboardState.isAdmin || dashboardState.pendingUserIds.has(user.userId),
    isLoading: dashboardState.pendingUserIds.has(user.userId),
  }));

  root.innerHTML = UsersTable(usersWithUiState, { canEdit: dashboardState.isAdmin });
}

function showToast(message, tone = "success") {
  const toast = document.getElementById("adminToast");
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function updateLocalUserPayment(userId, paidStatus) {
  const now = paidStatus ? new Date().toISOString() : null;
  dashboardState.users = dashboardState.users.map((user) => {
    if (user.userId !== userId) return user;
    return {
      ...user,
      hasPaid: paidStatus,
      plan: paidStatus ? "paid" : "free",
      paymentDate: now,
      lastActive: Date.now(),
    };
  });
}

function getUserSnapshot(userId) {
  return dashboardState.users.find((user) => user.userId === userId) || null;
}

async function handlePaymentToggle(userId, nextPaidStatus) {
  if (!dashboardState.isAdmin || dashboardState.pendingUserIds.has(userId)) return;

  const previous = getUserSnapshot(userId);
  if (!previous) return;

  dashboardState.pendingUserIds.add(userId);
  updateLocalUserPayment(userId, nextPaidStatus);
  renderDashboard();

  try {
    await updateUserPayment(userId, nextPaidStatus);
    showToast(nextPaidStatus ? "User upgraded to paid" : "User downgraded to free", "success");
  } catch (_error) {
    dashboardState.users = dashboardState.users.map((user) => (user.userId === userId ? previous : user));
    showToast("Update failed. Reverted.", "error");
  } finally {
    dashboardState.pendingUserIds.delete(userId);
    renderDashboard();
  }
}

function bindControls() {
  const searchInput = document.getElementById("userSearchInput");
  const filterSelect = document.getElementById("paymentFilterSelect");
  const sortSelect = document.getElementById("sortSelect");

  searchInput?.addEventListener("input", (event) => {
    dashboardState.query = event.target.value || "";
    renderDashboard();
  });

  filterSelect?.addEventListener("change", (event) => {
    dashboardState.filter = event.target.value || "all";
    renderDashboard();
  });

  sortSelect?.addEventListener("change", (event) => {
    dashboardState.sort = event.target.value || "lastActive_desc";
    renderDashboard();
  });

  const tableRoot = document.getElementById("adminTableRoot");
  tableRoot?.addEventListener("change", async (event) => {
    const toggle = event.target.closest("[data-action='toggle-paid']");
    if (toggle) {
      const paymentControls = toggle.closest(".payment-controls");
      const userId = paymentControls?.getAttribute("data-user-id");
      if (!userId) return;

      await handlePaymentToggle(userId, Boolean(toggle.checked));
      return;
    }
  });

  document.getElementById("generateBlogBtn")?.addEventListener("click", handleGenerateBlogPost);
  document.getElementById("publishBlogBtn")?.addEventListener("click", handlePublishBlogPost);
  document.getElementById("runAutoBlogBtn")?.addEventListener("click", handleRunAutoBlogGeneration);
  document.getElementById("runSeoBatchBtn")?.addEventListener("click", handleRunSeoBatchGeneration);
  syncBlogGeneratorUiState();
}

async function refreshUsers() {
  dashboardState.users = await fetchUsers();
  console.log("Admin users loaded:", dashboardState.users.length);
  if (!dashboardState.users.length) {
    console.warn("Admin users table is empty.");
  }
  renderDashboard();
}

async function initDashboard() {
  renderLoadingState();

  try {
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      dashboardState.isAdmin = false;
      console.log("Admin state:", dashboardState.isAdmin);
      renderAuthGate("Please sign in to continue.");
      return;
    }

    dashboardState.currentUserId = currentUser.id;

    const userData = await getOrCreateUserData(currentUser);
    if (!userData) {
      dashboardState.isAdmin = false;
      console.log("Admin state:", dashboardState.isAdmin);
      renderAccessDenied("Unable to load your user profile. Check console logs for AUTH USER, USER ROW, and ERROR.");
      bindControls();
      return;
    }

    if (userData.id !== currentUser.id) {
      console.error("AUTH/PROFILE ID MISMATCH:", {
        authUserId: currentUser.id,
        profileUserId: userData.id,
      });
    }

    console.log("is_admin value:", userData.is_admin);
    dashboardState.isAdmin = userData.is_admin === true;
    console.log("Admin state:", dashboardState.isAdmin);

    if (!dashboardState.isAdmin) {
      renderAccessDenied("Your account is signed in, but is_admin is false.");
      bindControls();
      return;
    }

    renderPostAuthDashboard();

    await maybeTrackPaymentFromUrl();
    await syncCurrentUserPresence();
    await refreshUsers();
    await subscribeToUsers(refreshUsers);
  } catch (error) {
    dashboardState.isAdmin = false;
    renderAuthGate(String(error?.message || "Unable to verify your session right now. Please try signing in again."));
    const root = document.getElementById("adminTableRoot");
    if (root) root.innerHTML = "";
  }

  bindControls();
}

document.getElementById("adminGateSignInBtn")?.addEventListener("click", () => {
  if (window.BulletAuth && typeof window.BulletAuth.openAuthModal === "function") {
    window.BulletAuth.openAuthModal();
  }
});

initDashboard();
