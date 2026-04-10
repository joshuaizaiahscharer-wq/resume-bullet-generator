const mockUsers = [
  {
    userId: "usr_1f8bc293",
    email: "ava.turner@example.com",
    isLoggedIn: true,
    hasPaid: true,
    plan: "paid",
    paymentDate: "2026-04-03T12:21:00Z",
    lastActive: 1712794582000,
  },
  {
    userId: "usr_9a42ed10",
    email: "mason.lee@example.com",
    isLoggedIn: false,
    hasPaid: false,
    plan: "free",
    paymentDate: null,
    lastActive: 1712609104000,
  },
  {
    userId: "usr_22bb4a61",
    email: "nina.patel@example.com",
    isLoggedIn: true,
    hasPaid: false,
    plan: "free",
    paymentDate: null,
    lastActive: 1712791015000,
  },
  {
    userId: "usr_6de14ef8",
    email: "oliver.garcia@example.com",
    isLoggedIn: false,
    hasPaid: true,
    plan: "paid",
    paymentDate: "2026-03-29T09:12:00Z",
    lastActive: 1712715200000,
  },
  {
    userId: "usr_53c84fd3",
    email: "sofia.nguyen@example.com",
    isLoggedIn: true,
    hasPaid: true,
    plan: "paid",
    paymentDate: "2026-04-07T18:47:00Z",
    lastActive: 1712797300000,
  },
  {
    userId: "usr_74ad114b",
    email: "ethan.clark@example.com",
    isLoggedIn: false,
    hasPaid: false,
    plan: "free",
    paymentDate: null,
    lastActive: 1712440200000,
  },
];

/**
 * Placeholder API hook for future backend connection.
 * Swap implementation with fetch('/api/admin/users') or Firebase query.
 */
async function fetchUsers() {
  await new Promise((resolve) => setTimeout(resolve, 140));
  return mockUsers;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function StatusBadge(type, value) {
  if (type === "login") {
    return value
      ? '<span class="status-inline"><span class="status-dot status-dot--online"></span>Online</span>'
      : '<span class="status-inline"><span class="status-dot status-dot--offline"></span>Offline</span>';
  }

  if (type === "payment") {
    return value
      ? '<span class="badge badge--paid">Paid</span>'
      : '<span class="badge badge--free">Free</span>';
  }

  if (type === "plan") {
    return value === "paid"
      ? '<span class="pill pill--paid">Paid</span>'
      : '<span class="pill">Free</span>';
  }

  return "";
}

function Row(user) {
  return `
    <tr>
      <td class="user-id-cell">${escapeHtml(user.userId)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${StatusBadge("login", user.isLoggedIn)}</td>
      <td>${StatusBadge("payment", user.hasPaid)}</td>
      <td>${StatusBadge("plan", user.plan)}</td>
      <td>${user.paymentDate ? escapeHtml(formatDateTime(user.paymentDate)) : "-"}</td>
      <td>${escapeHtml(formatDateTime(user.lastActive))}</td>
    </tr>
  `;
}

function Table(users) {
  if (!users.length) {
    return '<div class="empty-state">No users match your current search/filter.</div>';
  }

  const rows = users.map((user) => Row(user)).join("\n");

  return `
    <table class="admin-table" aria-label="Users with login and payment status">
      <thead>
        <tr>
          <th>User ID</th>
          <th>Email</th>
          <th>Logged In Status</th>
          <th>Payment Status</th>
          <th>Plan</th>
          <th>Payment Date</th>
          <th>Last Active</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

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

async function initDashboard() {
  dashboardState.users = await fetchUsers();
  bindControls();
  renderDashboard();
}

initDashboard();
