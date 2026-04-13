import { UsersTable } from "/admin/ui-components.js";
import {
  fetchUsers,
  generateBlogPostDraft,
  maybeTrackPaymentFromUrl,
  publishBlogPost,
  subscribeToUsers,
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

  if (generateBtn) {
    generateBtn.disabled = dashboardState.blogLoading;
    generateBtn.textContent = dashboardState.blogLoading ? "Generating..." : "Generate Post";
  }

  if (publishBtn) {
    publishBtn.disabled =
      dashboardState.blogLoading || !dashboardState.blogDraft?.title || !dashboardState.blogDraft?.content;
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
    const subtitle = gate.querySelector(".admin-gate-subtitle");
    if (subtitle && message) subtitle.textContent = message;
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
    const authResp = await fetch("/api/auth/user", { credentials: "include" });
    if (!authResp.ok) {
      dashboardState.isAdmin = false;
      renderAuthGate("Enter your admin password to continue.");
      bindControls();
      return;
    }

    const currentUser = await authResp.json();
    if (!currentUser || !currentUser.id) {
      dashboardState.isAdmin = false;
      renderAuthGate("Enter your admin password to continue.");
      bindControls();
      return;
    }

    dashboardState.currentUserId = currentUser.id;

    const adminCheckResp = await fetch(`/api/admin/support`, { credentials: "include" });
    if (adminCheckResp.status === 401) {
      dashboardState.isAdmin = false;
      renderAuthGate("Enter your admin password to continue.");
      bindControls();
      return;
    }

    if (adminCheckResp.status === 403) {
      dashboardState.isAdmin = false;
      renderAccessDenied("Access denied.");
      bindControls();
      return;
    }

    if (!adminCheckResp.ok) {
      dashboardState.isAdmin = false;
      renderAccessDenied("Unable to verify admin access. Please try again later.");
      bindControls();
      return;
    }

    dashboardState.isAdmin = true;
    console.log("Admin state:", dashboardState.isAdmin);

    renderPostAuthDashboard();

    await maybeTrackPaymentFromUrl();
    await refreshUsers();
    await subscribeToUsers(refreshUsers);
  } catch (error) {
    const root = document.getElementById("adminTableRoot");
    if (root) {
      root.innerHTML = `<div class="empty-state">Unable to load users: ${String(error?.message || "Unknown error")}</div>`;
    }
  }

  bindControls();
}

document.getElementById("adminPasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("adminPasswordInput")?.value || "";
  const errorEl = document.getElementById("adminPasswordError");
  if (errorEl) errorEl.style.display = "none";

  try {
    const resp = await fetch("/api/admin/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (resp.ok) {
      await initDashboard();
    } else {
      if (errorEl) errorEl.style.display = "block";
    }
  } catch (err) {
    if (errorEl) errorEl.style.display = "block";
  }
});

initDashboard();
