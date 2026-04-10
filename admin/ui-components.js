function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export function StatusBadge(type, value) {
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

export function Row(user) {
  const controlsDisabled = user.controlsDisabled ? "disabled" : "";
  const busyClass = user.controlsDisabled ? " payment-toggle--busy" : "";

  return `
    <tr>
      <td class="user-id-cell">${escapeHtml(user.userId)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${StatusBadge("login", user.isLoggedIn)}</td>
      <td>${StatusBadge("payment", user.hasPaid)}</td>
      <td>${StatusBadge("plan", user.plan)}</td>
      <td>${user.paymentDate ? escapeHtml(formatDateTime(user.paymentDate)) : "-"}</td>
      <td>${escapeHtml(formatDateTime(user.lastActive))}</td>
      <td>
        <div class="payment-controls" data-user-id="${escapeHtml(user.userId)}">
          <button
            class="payment-toggle${busyClass}"
            data-action="toggle-paid"
            data-next-paid="${user.hasPaid ? "false" : "true"}"
            aria-label="Toggle paid status"
            ${controlsDisabled}
          >
            <span class="payment-toggle-track ${user.hasPaid ? "is-paid" : "is-free"}">
              <span class="payment-toggle-thumb"></span>
            </span>
            <span class="payment-toggle-label">${user.hasPaid ? "Paid" : "Free"}</span>
          </button>

          <select class="plan-select" data-action="change-plan" ${controlsDisabled}>
            <option value="free" ${user.plan === "free" ? "selected" : ""}>Free</option>
            <option value="paid" ${user.plan === "paid" ? "selected" : ""}>Paid</option>
          </select>
        </div>
      </td>
    </tr>
  `;
}

export function Table(users, options = {}) {
  const canEdit = Boolean(options.canEdit);

  if (!users.length) {
    return '<div class="empty-state">No users match your current search/filter.</div>';
  }

  const accessNote = canEdit
    ? ""
    : '<div class="admin-access-note">Read-only mode. Admin access is required for payment edits.</div>';

  const rows = users.map((user) => Row(user)).join("\n");

  return `
    ${accessNote}
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
          <th>Edit Payment</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
