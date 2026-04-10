import { Table } from "/admin/ui-components.js";
import {
  fetchUsers,
  maybeTrackPaymentFromUrl,
  subscribeToUsers,
  syncCurrentUserPresence,
} from "/admin/users-data.js";

const dashboardState = {
  users: [],
  query: "",
  filter: "all",
  sort: "lastActive_desc",
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

  root.innerHTML = Table(sorted);
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
}

async function refreshUsers() {
  dashboardState.users = await fetchUsers();
  renderDashboard();
}

async function initDashboard() {
  try {
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
