import { Table } from "/admin/ui-components.js";
import {
  fetchUsers,
  getCurrentAuthUser,
  isAdminUser,
  maybeTrackPaymentFromUrl,
  subscribeToUsers,
  syncCurrentUserPresence,
  updateUserPayment,
  updateUserPlan,
} from "/admin/users-data.js";

const dashboardState = {
  users: [],
  query: "",
  filter: "all",
  sort: "lastActive_desc",
  isAdmin: false,
  pendingUserIds: new Set(),
};

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
  }));

  root.innerHTML = Table(usersWithUiState, { canEdit: dashboardState.isAdmin });
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

async function handlePlanChange(userId, nextPlan) {
  await handlePaymentToggle(userId, nextPlan === "paid");
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

    const select = event.target.closest("[data-action='change-plan']");
    if (!select) return;

    const paymentControls = select.closest(".payment-controls");
    const userId = paymentControls?.getAttribute("data-user-id");
    if (!userId) return;

    const nextPlan = select.value || "free";
    try {
      dashboardState.pendingUserIds.add(userId);
      const previous = getUserSnapshot(userId);
      if (!previous) return;

      updateLocalUserPayment(userId, nextPlan === "paid");
      renderDashboard();

      await updateUserPlan(userId, nextPlan);
      showToast(nextPlan === "paid" ? "User upgraded to paid" : "User downgraded to free", "success");
    } catch (_error) {
      showToast("Update failed. Reverted.", "error");
      await refreshUsers();
    } finally {
      dashboardState.pendingUserIds.delete(userId);
      renderDashboard();
    }
  });
}

async function refreshUsers() {
  dashboardState.users = await fetchUsers();
  renderDashboard();
}

async function initDashboard() {
  try {
    const currentUser = await getCurrentAuthUser();
    dashboardState.isAdmin = isAdminUser(currentUser);

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

initDashboard();
