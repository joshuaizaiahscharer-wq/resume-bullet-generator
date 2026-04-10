import { UsersTable } from "/admin/ui-components.js";
import {
  fetchUsers,
  getCurrentAuthUser,
  getOrCreateUserData,
  maybeTrackPaymentFromUrl,
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
};

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
      renderAccessDenied("Please sign in to continue.");
      return;
    }

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
    const root = document.getElementById("adminTableRoot");
    if (root) {
      root.innerHTML = `<div class="empty-state">Unable to load users: ${String(error?.message || "Unknown error")}</div>`;
    }
  }

  bindControls();
}

document.getElementById("adminGateSignInBtn")?.addEventListener("click", () => {
  if (window.BulletAuth && typeof window.BulletAuth.openAuthModal === "function") {
    window.BulletAuth.openAuthModal();
  }
});

initDashboard();
